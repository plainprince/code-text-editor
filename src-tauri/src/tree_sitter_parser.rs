use tree_sitter::{Language, Parser, Node, Tree};
use serde::{Deserialize, Serialize};

// Use LANGUAGE constants from crates
use tree_sitter_javascript::LANGUAGE as JAVASCRIPT;
use tree_sitter_typescript::{LANGUAGE_TYPESCRIPT, LANGUAGE_TSX};
use tree_sitter_python::LANGUAGE as PYTHON;
use tree_sitter_rust::LANGUAGE as RUST;
use tree_sitter_go::LANGUAGE as GO;

pub fn get_language(language_id: &str) -> Result<Language, String> {
    match language_id {
        "javascript" | "js" => Ok(JAVASCRIPT.into()),
        "typescript" | "ts" => Ok(LANGUAGE_TYPESCRIPT.into()),
        "tsx" | "typescriptreact" => Ok(LANGUAGE_TSX.into()),
        "python" | "py" => Ok(PYTHON.into()),
        "rust" | "rs" => Ok(RUST.into()),
        "go" => Ok(GO.into()),
        _ => Err(format!("Unsupported language: {}", language_id)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentSymbol {
    pub name: String,
    pub kind: String,
    pub range: Range,
    pub selection_range: Range,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

fn extract_symbols_from_node(node: Node, source: &str, symbols: &mut Vec<DocumentSymbol>) {
    let node_type = node.kind();
    
    // Only extract relevant symbol types
    let symbol_kind = match node_type {
        "function_declaration" | "function_definition" | "function" => "Function",
        "class_declaration" | "class_definition" | "class" => "Class",
        "interface_declaration" | "interface" => "Interface",
        "variable_declaration" | "variable_declarator" | "let_declaration" | "const_declaration" => "Variable",
        "method_definition" | "method_declaration" => "Method",
        "enum_declaration" | "enum" => "Enum",
        "struct_declaration" | "struct_item" => "Struct",
        "impl_item" => "Namespace",
        "type_alias_declaration" | "type_item" => "TypeParameter",
        _ => {
            // Continue traversing children for other node types
            for child in node.children(&mut node.walk()) {
                extract_symbols_from_node(child, source, symbols);
            }
            return;
        }
    };

    // Extract symbol name
    let name = extract_symbol_name(node, source);
    if !name.is_empty() {
        let start_pos = node.start_position();
        let end_pos = node.end_position();
        
        let name_len = name.len() as u32;
        symbols.push(DocumentSymbol {
            name,
            kind: symbol_kind.to_string(),
            range: Range {
                start: Position {
                    line: start_pos.row as u32,
                    character: start_pos.column as u32,
                },
                end: Position {
                    line: end_pos.row as u32,
                    character: end_pos.column as u32,
                },
            },
            selection_range: Range {
                start: Position {
                    line: start_pos.row as u32,
                    character: start_pos.column as u32,
                },
                end: Position {
                    line: start_pos.row as u32,
                    character: start_pos.column as u32 + name_len,
                },
            },
        });
    }

    // Continue traversing children
    for child in node.children(&mut node.walk()) {
        extract_symbols_from_node(child, source, symbols);
    }
}

fn extract_symbol_name(node: Node, source: &str) -> String {
    // Try to find an identifier child node
    for child in node.children(&mut node.walk()) {
        if child.kind() == "identifier" || child.kind() == "type_identifier" {
            return source[child.byte_range()].to_string();
        }
    }
    
    // Fallback: use the first word of the node text
    let text = &source[node.byte_range()];
    text.split_whitespace()
        .nth(1) // Skip the keyword (function, class, etc.)
        .unwrap_or("")
        .split('(')
        .next()
        .unwrap_or("")
        .to_string()
}

#[tauri::command]
pub fn parse_document_symbols(
    content: String,
    language_id: String,
) -> Result<Vec<DocumentSymbol>, String> {
    let language = get_language(&language_id)?;
    
    let mut parser = Parser::new();
    parser.set_language(&language)
        .map_err(|e| format!("Failed to set language: {}", e))?;
    
    let tree = parser.parse(&content, None)
        .ok_or("Failed to parse content")?;
    
    let mut symbols = Vec::new();
    let root_node = tree.root_node();
    
    extract_symbols_from_node(root_node, &content, &mut symbols);
    
    Ok(symbols)
}
