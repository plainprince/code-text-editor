fn main() {
    // Ensure tree-sitter grammars are properly linked
    println!("cargo:rustc-link-lib=static=tree-sitter");
    
    // Print debug information for build
    println!("cargo:warning=Building with tree-sitter support");
    
    tauri_build::build()
}
