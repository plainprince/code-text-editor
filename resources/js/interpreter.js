// Node.js imports removed for Neutralino frontend compatibility

const TOKENS = {
  IDENTIFIER: "IDENTIFIER",
  NUMBER: "NUMBER",
  STRING: "STRING",
  KEYWORD: "KEYWORD",
  OPERATOR: "OPERATOR",
  PUNCTUATION: "PUNCTUATION",
  EOF: "EOF",
};

const KEYWORDS = [
  "if",
  "else",
  "elseif",
  "while",
  "for",
  "end",
  "null",
  "undefined",
  "true",
  "false",
  "function",
  "return",
  "break",
  "continue",
  "not",
  "and",
  "or",
];

class Lexer {
  constructor(code) {
    this.code = code;
    this.position = 0;
  }

  tokenize() {
    const tokens = [];
    while (this.position < this.code.length) {
      this.skipWhitespace();
      if (this.position >= this.code.length) break;

      const char = this.code[this.position];
      const nextChar = this.code[this.position + 1];

      if (char === "#") {
        this.readComment();
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifierOrKeyword());
      } else if (/[0-9]/.test(char)) {
        tokens.push({ type: TOKENS.NUMBER, value: this.readNumber() });
      } else if (char === '"' || char === "'") {
        tokens.push({ type: TOKENS.STRING, value: this.readString(char) });
      } else {
        const twoCharOp = char + nextChar;
        if (
          [
            "==",
            "!=",
            "<=",
            ">=",
            "||",
            "&&",
            "+=",
            "-=",
            "*=",
            "/=",
            "++",
            "--",
          ].includes(twoCharOp)
        ) {
          tokens.push({ type: TOKENS.PUNCTUATION, value: twoCharOp });
          this.position += 2;
        } else if (/[=+\-*/<>()$,;[\]{}:.]/.test(char)) {
          tokens.push({ type: TOKENS.PUNCTUATION, value: char });
          this.position++;
        } else {
          throw new Error(`Unexpected character: ${char}`);
        }
      }
    }
    tokens.push({ type: TOKENS.EOF });
    return tokens;
  }

  readIdentifierOrKeyword() {
    let value = "";
    while (
      this.position < this.code.length &&
      /[a-zA-Z0-9_]/.test(this.code[this.position])
    ) {
      value += this.code[this.position];
      this.position++;
    }
    const type = KEYWORDS.includes(value) ? TOKENS.KEYWORD : TOKENS.IDENTIFIER;
    return { type, value };
  }

  readNumber() {
    let value = "";
    while (
      this.position < this.code.length &&
      /[0-9.]/.test(this.code[this.position])
    ) {
      value += this.code[this.position];
      this.position++;
    }
    return parseFloat(value);
  }

  readString(quote) {
    let value = "";
    this.position++; // Skip opening quote
    while (
      this.position < this.code.length &&
      this.code[this.position] !== quote
    ) {
      let char = this.code[this.position];
      if (char === "\\") {
        this.position++; // Skip backslash
        let nextChar = this.code[this.position];
        switch (nextChar) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          case "r":
            value += "\r";
            break;
          case "\\":
            value += "\\";
            break;
          case "'":
            value += "'";
            break;
          case '"':
            value += '"';
            break;
          default:
            value += nextChar; // Keep the char after backslash if it's not a known escape sequence
        }
      } else {
        value += char;
      }
      this.position++;
    }
    this.position++; // Skip closing quote
    return value;
  }

  readComment() {
    while (
      this.position < this.code.length &&
      this.code[this.position] !== "\n"
    ) {
      this.position++;
    }
  }

  skipWhitespace() {
    while (
      this.position < this.code.length &&
      /\s/.test(this.code[this.position])
    ) {
      this.position++;
    }
  }
}

class ASTNode {}

class ProgramNode extends ASTNode {
  constructor(statements) {
    super();
    this.statements = statements;
  }
}

class AssignmentNode extends ASTNode {
  constructor(identifier, expression) {
    super();
    this.identifier = identifier;
    this.expression = expression;
  }
}

class FunctionDeclarationNode extends ASTNode {
  constructor(name, params, body) {
    super();
    this.name = name;
    this.params = params;
    this.body = body;
  }
}

class ReturnStatementNode extends ASTNode {
  constructor(expression) {
    super();
    this.expression = expression;
  }
}

class FunctionCallNode extends ASTNode {
  constructor(callee, args) {
    super();
    this.callee = callee;
    this.args = args;
  }
}

class IfNode extends ASTNode {
  constructor(condition, body, elseIfs, elseBody) {
    super();
    this.condition = condition;
    this.body = body;
    this.elseIfs = elseIfs;
    this.elseBody = elseBody;
  }
}

class WhileNode extends ASTNode {
  constructor(condition, body) {
    super();
    this.condition = condition;
    this.body = body;
  }
}

class ForNode extends ASTNode {
  constructor(identifier, count, body) {
    super();
    this.identifier = identifier;
    this.count = count;
    this.body = body;
  }
}

class BreakNode extends ASTNode {}
class ContinueNode extends ASTNode {}

class UnaryOpNode extends ASTNode {
  constructor(op, expression) {
    super();
    this.op = op;
    this.expression = expression;
  }
}

class UpdateExpressionNode extends ASTNode {
  constructor(op, identifier) {
    super();
    this.op = op;
    this.identifier = identifier;
  }
}

class BinaryOpNode extends ASTNode {
  constructor(left, op, right) {
    super();
    this.left = left;
    this.op = op;
    this.right = right;
  }
}

class VariableNode extends ASTNode {
  constructor(name) {
    super();
    this.name = name;
  }
}

class MemberAccessNode extends ASTNode {
  constructor(object, property) {
    super();
    this.object = object;
    this.property = property;
  }
}

class ArrayIndexNode extends ASTNode {
  constructor(object, index) {
    super();
    this.object = object;
    this.index = index;
  }
}

class ValueNode extends ASTNode {
  constructor(type, value) {
    super();
    this.type = type;
    this.value = value;
  }
}

class ArrayLiteralNode extends ASTNode {
  constructor(elements) {
    super();
    this.elements = elements;
  }
}

class ObjectLiteralNode extends ASTNode {
  constructor(properties) {
    super();
    this.properties = properties;
  }
}

class Parser {
  constructor(tokens, options = {}) {
    this.tokens = tokens;
    this.position = 0;
    this.options = options;
    this.loopDepth = 0;
  }

  parse() {
    const statements = [];
    while (!this.isAtEnd()) {
      statements.push(this.parseStatement());
    }
    return new ProgramNode(statements);
  }

  parseStatement() {
    const currentToken = this.peek();
    if (currentToken.type === TOKENS.KEYWORD) {
      switch (currentToken.value) {
        case "if":
          return this.parseIfStatement();
        case "while":
          return this.parseWhileStatement();
        case "for":
          return this.parseForStatement();
        case "function":
          return this.parseFunctionDeclaration();
        case "return":
          return this.parseReturnStatement();
        case "break":
          if (this.loopDepth === 0)
            throw new Error('Cannot use "break" outside of a loop.');
          this.consume();
          this.consumeSemicolon();
          return new BreakNode();
        case "continue":
          if (this.loopDepth === 0)
            throw new Error('Cannot use "continue" outside of a loop.');
          this.consume();
          this.consumeSemicolon();
          return new ContinueNode();
      }
    }

    const expression = this.parseExpression();
    this.consumeSemicolon();
    return expression;
  }

  parseFunctionDeclaration() {
    this.consume(TOKENS.KEYWORD, "function");
    const name = this.consume(TOKENS.IDENTIFIER).value;
    this.consume(TOKENS.PUNCTUATION, "(");
    const params = [];
    if (this.peek().value !== ")") {
      params.push(this.consume(TOKENS.IDENTIFIER).value);
      while (this.peek().value === ",") {
        this.consume(TOKENS.PUNCTUATION, ",");
        params.push(this.consume(TOKENS.IDENTIFIER).value);
      }
    }
    this.consume(TOKENS.PUNCTUATION, ")");
    this.consumeSemicolon();
    const body = [];
    while (!this.isAtEnd() && this.peek().value !== "end") {
      body.push(this.parseStatement());
    }
    this.consume(TOKENS.KEYWORD, "end");
    this.consumeSemicolon();
    return new FunctionDeclarationNode(name, params, body);
  }

  parseReturnStatement() {
    this.consume(TOKENS.KEYWORD, "return");
    const expression =
      this.peek().value === ";" ? null : this.parseExpression();
    this.consumeSemicolon();
    return new ReturnStatementNode(expression);
  }

  parseIfStatement() {
    this.consume(TOKENS.KEYWORD, "if");
    this.consume(TOKENS.PUNCTUATION, "(");
    const condition = this.parseExpression();
    this.consume(TOKENS.PUNCTUATION, ")");
    this.consumeSemicolon();
    const body = [];
    while (
      !this.isAtEnd() &&
      !["elseif", "else", "end"].includes(this.peek().value)
    ) {
      body.push(this.parseStatement());
    }

    const elseIfs = [];
    while (!this.isAtEnd() && this.peek().value === "elseif") {
      this.consume(TOKENS.KEYWORD, "elseif");
      this.consume(TOKENS.PUNCTUATION, "(");
      const elseIfCondition = this.parseExpression();
      this.consume(TOKENS.PUNCTUATION, ")");
      this.consumeSemicolon();
      const elseIfBody = [];
      while (
        !this.isAtEnd() &&
        !["elseif", "else", "end"].includes(this.peek().value)
      ) {
        elseIfBody.push(this.parseStatement());
      }
      elseIfs.push({ condition: elseIfCondition, body: elseIfBody });
    }

    let elseBody = null;
    if (!this.isAtEnd() && this.peek().value === "else") {
      this.consume(TOKENS.KEYWORD, "else");
      this.consumeSemicolon();
      elseBody = [];
      while (!this.isAtEnd() && this.peek().value !== "end") {
        elseBody.push(this.parseStatement());
      }
    }

    this.consume(TOKENS.KEYWORD, "end");
    this.consumeSemicolon();
    return new IfNode(condition, body, elseIfs, elseBody);
  }

  parseWhileStatement() {
    this.consume(TOKENS.KEYWORD, "while");
    this.consume(TOKENS.PUNCTUATION, "(");
    const condition = this.parseExpression();
    this.consume(TOKENS.PUNCTUATION, ")");
    this.consumeSemicolon();
    this.loopDepth++;
    const body = [];
    while (!this.isAtEnd() && this.peek().value !== "end") {
      body.push(this.parseStatement());
    }
    this.loopDepth--;
    this.consume(TOKENS.KEYWORD, "end");
    this.consumeSemicolon();
    return new WhileNode(condition, body);
  }

  parseForStatement() {
    this.consume(TOKENS.KEYWORD, "for");
    this.consume(TOKENS.PUNCTUATION, "(");
    const identifier = this.consume(TOKENS.IDENTIFIER).value;
    this.consume(TOKENS.PUNCTUATION, ",");
    const count = this.parseExpression();
    this.consume(TOKENS.PUNCTUATION, ")");
    this.consumeSemicolon();
    this.loopDepth++;
    const body = [];
    while (!this.isAtEnd() && this.peek().value !== "end") {
      body.push(this.parseStatement());
    }
    this.loopDepth--;
    this.consume(TOKENS.KEYWORD, "end");
    this.consumeSemicolon();
    return new ForNode(identifier, count, body);
  }

  parseExpression() {
    return this.parseAssignment();
  }

  parseAssignment() {
    const left = this.parseLogicalOr();
    if (!this.isAtEnd() && this.peek().value === "=") {
      this.consume(TOKENS.PUNCTUATION, "=");
      const right = this.parseAssignment();
      if (
        left instanceof VariableNode ||
        left instanceof MemberAccessNode ||
        left instanceof ArrayIndexNode
      ) {
        return new AssignmentNode(left, right);
      }
      throw new Error("Invalid assignment target");
    }
    return left;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (
      !this.isAtEnd() &&
      (this.peek().value === "||" ||
        (this.peek().type === TOKENS.KEYWORD && this.peek().value === "or"))
    ) {
      const op = this.consume().value;
      const right = this.parseLogicalAnd();
      left = new BinaryOpNode(left, op, right);
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (
      !this.isAtEnd() &&
      (this.peek().value === "&&" ||
        (this.peek().type === TOKENS.KEYWORD && this.peek().value === "and"))
    ) {
      const op = this.consume().value;
      const right = this.parseEquality();
      left = new BinaryOpNode(left, op, right);
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (
      !this.isAtEnd() &&
      (this.peek().value === "==" || this.peek().value === "!=")
    ) {
      const op = this.consume(TOKENS.PUNCTUATION).value;
      const right = this.parseComparison();
      left = new BinaryOpNode(left, op, right);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAddition();
    while (
      !this.isAtEnd() &&
      ["<", ">", "<=", ">="].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseAddition();
      left = new BinaryOpNode(left, op, right);
    }
    return left;
  }

  parseAddition() {
    let left = this.parseMultiplication();
    while (
      !this.isAtEnd() &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.consume().value;
      const right = this.parseMultiplication();
      left = new BinaryOpNode(left, op, right);
    }
    return left;
  }

  parseMultiplication() {
    let left = this.parseUnary();
    while (
      !this.isAtEnd() &&
      (this.peek().value === "*" || this.peek().value === "/")
    ) {
      const op = this.consume(TOKENS.PUNCTUATION).value;
      const right = this.parseUnary();
      left = new BinaryOpNode(left, op, right);
    }
    return left;
  }

  parseUnary() {
    const currentToken = this.peek();
    if (
      !this.isAtEnd() &&
      (currentToken.value === "!" ||
        currentToken.value === "-" ||
        (currentToken.type === TOKENS.KEYWORD && currentToken.value === "not"))
    ) {
      const op = this.consume().value;
      const expression = this.parseUnary();
      return new UnaryOpNode(op, expression);
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    let expr = this.parseSimplePrimary();
    while (true) {
      if (!this.isAtEnd() && this.peek().value === ".") {
        this.consume(TOKENS.PUNCTUATION, ".");
        const property = this.consume(TOKENS.IDENTIFIER).value;
        expr = new MemberAccessNode(expr, property);
      } else if (!this.isAtEnd() && this.peek().value === "[") {
        this.consume(TOKENS.PUNCTUATION, "[");
        const index = this.parseExpression();
        this.consume(TOKENS.PUNCTUATION, "]");
        expr = new ArrayIndexNode(expr, index);
      } else if (!this.isAtEnd() && this.peek().value === "(") {
        this.consume(TOKENS.PUNCTUATION, "(");
        const args = [];
        if (this.peek().value !== ")") {
          args.push(this.parseExpression());
          while (this.peek().value === ",") {
            this.consume(TOKENS.PUNCTUATION, ",");
            args.push(this.parseExpression());
          }
        }
        this.consume(TOKENS.PUNCTUATION, ")");
        expr = new FunctionCallNode(expr, args);
      } else {
        break;
      }
    }
    return expr;
  }

  parseSimplePrimary() {
    const token = this.peek();
    if (
      this.options.inStringInterpolation &&
      token.type === TOKENS.IDENTIFIER
    ) {
      return new VariableNode(this.consume().value);
    }
    if (token.type === TOKENS.NUMBER)
      return new ValueNode("number", this.consume().value);
    if (token.type === TOKENS.STRING)
      return new ValueNode("string", this.consume().value);
    if (token.value === "null") {
      this.consume();
      return new ValueNode("null", null);
    }
    if (token.value === "undefined") {
      this.consume();
      return new ValueNode("undefined", undefined);
    }
    if (token.value === "true") {
      this.consume();
      return new ValueNode("boolean", true);
    }
    if (token.value === "false") {
      this.consume();
      return new ValueNode("boolean", false);
    }
    if (token.value === "$") {
      this.consume();
      return new VariableNode(this.consume(TOKENS.IDENTIFIER).value);
    }
    if (token.type === TOKENS.IDENTIFIER)
      return new VariableNode(this.consume().value);
    if (token.value === "[") return this.parseArrayLiteral();
    if (token.value === "{") return this.parseObjectLiteral();
    if (token.value === "(") {
      this.consume();
      const expr = this.parseExpression();
      this.consume(TOKENS.PUNCTUATION, ")");
      return expr;
    }
    throw new Error(`Unexpected token: ${token.type} ${token.value}`);
  }

  parseArrayLiteral() {
    this.consume(TOKENS.PUNCTUATION, "[");
    const elements = [];
    if (this.peek().value !== "]") {
      elements.push(this.parseExpression());
      while (this.peek().value === ",") {
        this.consume();
        elements.push(this.parseExpression());
      }
    }
    this.consume(TOKENS.PUNCTUATION, "]");
    return new ArrayLiteralNode(elements);
  }

  parseObjectLiteral() {
    this.consume(TOKENS.PUNCTUATION, "{");
    const properties = new Map();
    if (this.peek().value !== "}") {
      do {
        const key = this.consume(
          this.peek().type === TOKENS.STRING
            ? TOKENS.STRING
            : TOKENS.IDENTIFIER,
        ).value;
        this.consume(TOKENS.PUNCTUATION, ":");
        const value = this.parseExpression();
        properties.set(key, value);
      } while (this.peek().value === "," && (this.consume(), true));
    }
    this.consume(TOKENS.PUNCTUATION, "}");
    return new ObjectLiteralNode(properties);
  }

  consumeSemicolon() {
    if (!this.isAtEnd() && this.peek().value === ";") {
      this.consume(TOKENS.PUNCTUATION, ";");
    }
  }

  consume(type, value = null) {
    const token = this.tokens[this.position];
    if (this.isAtEnd()) {
      throw new Error("Unexpected end of input");
    }
    if (
      !type ||
      (token.type === type && (value === null || token.value === value))
    ) {
      this.position++;
      return token;
    }
    throw new Error(
      `Expected ${type} with value ${value} but got ${token.type} with value ${token.value}`,
    );
  }

  peek() {
    return this.tokens[this.position];
  }

  peekNext() {
    return this.tokens[this.position + 1];
  }

  isAtEnd() {
    return (
      this.position >= this.tokens.length || this.peek().type === TOKENS.EOF
    );
  }
}

async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
}

class Interpreter {
  constructor(state, options = {}) {
    this.state = state;
    this.options = options;
  }

  async interpret(node) {
    return await this.visit(node);
  }

  async visit(node) {
    if (!node) {
      throw new Error(
        "Interpreter Error: trying to visit a non-existent node.",
      );
    }
    if (node instanceof ProgramNode) return await this.visitProgram(node);
    if (node instanceof AssignmentNode) return await this.visitAssignment(node);
    if (node instanceof FunctionDeclarationNode)
      return await this.visitFunctionDeclaration(node);
    if (node instanceof ReturnStatementNode)
      return await this.visitReturnStatement(node);
    if (node instanceof FunctionCallNode)
      return await this.visitFunctionCall(node);
    if (node instanceof IfNode) return await this.visitIf(node);
    if (node instanceof WhileNode) return await this.visitWhile(node);
    if (node instanceof ForNode) return await this.visitFor(node);
    if (node instanceof BreakNode) throw new BreakSignal();
    if (node instanceof ContinueNode) throw new ContinueSignal();
    if (node instanceof UnaryOpNode) return await this.visitUnaryOp(node);
    if (node instanceof UpdateExpressionNode)
      return await this.visitUpdateExpression(node);
    if (node instanceof BinaryOpNode) return await this.visitBinaryOp(node);
    if (node instanceof VariableNode) return await this.visitVariable(node);
    if (node instanceof MemberAccessNode)
      return await this.visitMemberAccess(node);
    if (node instanceof ArrayIndexNode) return await this.visitArrayIndex(node);
    if (node instanceof ValueNode) return await this.visitValue(node);
    if (node instanceof ArrayLiteralNode)
      return await this.visitArrayLiteral(node);
    if (node instanceof ObjectLiteralNode)
      return await this.visitObjectLiteral(node);
    throw new Error(`Unknown node type: ${node.constructor.name}`);
  }

  async visitProgram(node) {
    for (const statement of node.statements) {
      await this.visit(statement);
    }
  }

  async visitAssignment(node) {
    const value = await this.visit(node.expression);
    if (node.identifier instanceof VariableNode) {
      this.state.variables[node.identifier.name] = value;
    } else if (node.identifier instanceof MemberAccessNode) {
      const obj = await this.visit(node.identifier.object);
      obj[node.identifier.property] = value;
    } else if (node.identifier instanceof ArrayIndexNode) {
      const obj = await this.visit(node.identifier.object);
      const index = await this.visit(node.identifier.index);
      obj[index] = value;
    }
  }

  async visitFunctionDeclaration(node) {
    const func = async (...args) => {
      const savedParamValues = {};
      for (let i = 0; i < node.params.length; i++) {
        const paramName = node.params[i];
        if (
          Object.prototype.hasOwnProperty.call(this.state.variables, paramName)
        ) {
          savedParamValues[paramName] = this.state.variables[paramName];
        }
        this.state.variables[paramName] = args[i];
      }

      let result;
      try {
        for (const statement of node.body) {
          await this.visit(statement);
        }
      } catch (e) {
        if (e instanceof ReturnValue) {
          result = e.value;
        } else {
          throw e;
        }
      } finally {
        for (let i = 0; i < node.params.length; i++) {
          const paramName = node.params[i];
          if (
            Object.prototype.hasOwnProperty.call(savedParamValues, paramName)
          ) {
            this.state.variables[paramName] = savedParamValues[paramName];
          } else {
            delete this.state.variables[paramName];
          }
        }
      }
      return result;
    };
    this.state.variables[node.name] = func.bind(this);
  }

  async visitReturnStatement(node) {
    throw new ReturnValue(
      node.expression ? await this.visit(node.expression) : null,
    );
  }

  async visitFunctionCall(node) {
    const callee = await this.visit(node.callee);
    const args = await Promise.all(node.args.map((arg) => this.visit(arg)));

    if (typeof callee !== "function") {
      throw new Error(`${node.callee.name || "Value"} is not a function`);
    }

    // Check if it's one of our special native functions
    if (callee.isCustomNative) {
      return await callee(...args);
    }

    return await callee(...args);
  }

  async visitIf(node) {
    if (await this.visit(node.condition)) {
      for (const statement of node.body) await this.visit(statement);
    } else {
      for (const elseIf of node.elseIfs) {
        if (await this.visit(elseIf.condition)) {
          for (const statement of elseIf.body) await this.visit(statement);
          return;
        }
      }
      if (node.elseBody) {
        for (const statement of node.elseBody) await this.visit(statement);
      }
    }
  }

  async visitWhile(node) {
    while (await this.visit(node.condition)) {
      try {
        for (const statement of node.body) {
          await this.visit(statement);
        }
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
  }

  async visitFor(node) {
    const count = await this.visit(node.count);
    for (let i = 0; i < count; i++) {
      this.state.variables[node.identifier] = i;
      try {
        for (const statement of node.body) {
          await this.visit(statement);
        }
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
  }

  async visitBinaryOp(node) {
    const left = await this.visit(node.left);
    const right = await this.visit(node.right);
    switch (node.op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      case "==":
        return left == right;
      case "!=":
        return left != right;
      case "&&":
      case "and":
        return left && right;
      case "||":
      case "or":
        return left || right;
    }
    throw new Error(`Unknown operator: ${node.op}`);
  }

  async visitVariable(node) {
    if (this.state.variables.hasOwnProperty(node.name)) {
      return this.state.variables[node.name];
    }
    throw new Error(`Undefined variable: ${node.name}`);
  }

  async visitValue(node) {
    if (node.type === "string" && node.value.includes("${")) {
      return await replaceAsync(
        node.value,
        /\${(.*?)}/g,
        async (match, expression) => {
          const lexer = new Lexer(expression);
          let tokens = lexer.tokenize();
          tokens = tokens.filter((t) => t.type !== TOKENS.EOF);
          const parser = new Parser(tokens, { inStringInterpolation: true });
          const ast = parser.parseExpression();
          return await this.visit(ast);
        },
      );
    }
    return node.value;
  }

  async visitMemberAccess(node) {
    const object = await this.visit(node.object);
    if (object === undefined || object === null) {
      throw new Error(`Cannot access property '${node.property}' of ${object}`);
    }
    const prop = object[node.property];
    if (typeof prop === "function") {
      return prop.bind(object);
    }
    return prop;
  }

  async visitArrayIndex(node) {
    const object = await this.visit(node.object);
    const index = await this.visit(node.index);
    if (object === undefined || object === null) {
      throw new Error(`Cannot access index '${index}' of ${object}`);
    }
    return object[index];
  }

  async visitArrayLiteral(node) {
    return await Promise.all(node.elements.map((el) => this.visit(el)));
  }

  async visitObjectLiteral(node) {
    const obj = {};
    for (const [key, valueNode] of node.properties) {
      obj[key] = await this.visit(valueNode);
    }
    return obj;
  }

  async visitUnaryOp(node) {
    const value = await this.visit(node.expression);
    switch (node.op) {
      case "!":
      case "not":
        return !value;
      case "-":
        return -value;
    }
    throw new Error(`Unknown unary operator: ${node.op}`);
  }

  async visitUpdateExpression(node) {
    const value = this.state.variables[node.identifier];
    switch (node.op) {
      case "++":
        this.state.variables[node.identifier] = value + 1;
        return value;
      case "--":
        this.state.variables[node.identifier] = value - 1;
        return value;
    }
    throw new Error(`Unknown update operator: ${node.op}`);
  }
}

class ReturnValue extends Error {
  constructor(value) {
    super(null);
    this.value = value;
  }
}
class BreakSignal extends Error {}
class ContinueSignal extends Error {}
class ExitSignal extends Error {}

function getInitialState(callbacks = {}, settings = {}) {
  const {
    onChunk = () => {},
    onCanvasUpdate = () => {},
    wait = () => Promise.resolve(),
    onConsoleClear = () => {},
    customFunctions = {},
  } = callbacks;
  const state = {
    canvas: {
      resolution: settings.canvas?.resolution || { x: 128, y: 64 },
      background: settings.canvas?.background || { r: 0, g: 0, b: 0 },
      pixels: [],
    },
    config: {
      version: "1.0",
      editor: "unknown",
      autosave: false,
    },
    variables: {},
  };

  // Expose config as a variable in the interpreter
  state.variables.config = state.config;

  const formatArg = (arg) => {
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return "[Circular Object]";
      }
    }
    return arg;
  };

  state.variables.rect = (x, y, width, height, r, g, b) => {
    const rectCommand = {
      command: "rect",
      x,
      y,
      width,
      height,
      color: { r, g, b },
    };
    onCanvasUpdate(rectCommand);
  };

  state.variables.pixel = (x, y, r, g, b) => {
    const pixelCommand = { command: "pixel", x, y, color: { r, g, b } };
    onCanvasUpdate(pixelCommand);
  };

  state.variables.clear = () => {
    onCanvasUpdate({ command: "clear", color: state.canvas.background });
  };

  state.variables.math = {
    random: Math.random,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    abs: Math.abs,
    sqrt: Math.sqrt,
    pow: Math.pow,
  };

  state.variables.console = {
    log: (...args) => onChunk(args.map(formatArg).join(" ") + "\n"),
    warn: (...args) =>
      onChunk(`\x1b[33m${args.map(formatArg).join(" ")}\x1b[0m\n`),
    error: (...args) =>
      onChunk(`\x1b[31m${args.map(formatArg).join(" ")}\x1b[0m\n`),
    clear: onConsoleClear,
  };

  state.variables.exit = () => {
    throw new ExitSignal();
  };

  state.variables.wait = wait;

  if (settings.enableFs) {
    state.variables.fs = {
      readFileSync: async (path) => {
        const result = await Neutralino.filesystem.readFile(path);
        return result.content;
      },
      writeFileSync: async (path, data) => {
        await Neutralino.filesystem.writeFile({ fileName: path, data });
      },
      readdirSync: async (path) => {
        const result = await Neutralino.filesystem.readDirectory(path);
        return result.entries;
      },
    };
  }

  if (settings.enableShell) {
    state.variables.shell = {
      execSync: async (command) => {
        const result = await Neutralino.os.execCommand(command);
        return result.stdOut;
      },
    };
  }

  for (const [name, func] of Object.entries(customFunctions)) {
    const nativeFunc = (...args) => func(state, ...args);
    nativeFunc.isCustomNative = true;
    state.variables[name] = nativeFunc;
  }

  return state;
}

async function interpret(code, state, settings = {}) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  const ast = parser.parse();

  const interpreter = new Interpreter(state, settings);
  try {
    await interpreter.interpret(ast);
  } catch (e) {
    if (e instanceof ExitSignal) {
      // Graceful exit
    } else {
      throw e;
    }
  }
}

module.exports = {
  interpret,
  getInitialState,
  Lexer,
  Parser,
  Interpreter,
  ExitSignal,
  BreakSignal,
  ContinueSignal,
  ReturnValue,
};
