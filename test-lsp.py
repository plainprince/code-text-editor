# Python test file for LSP auto-detection
class Calculator:
    """A simple calculator class to test Python LSP features."""
    
    def __init__(self):
        self.history = []
    
    def add(self, a: float, b: float) -> float:
        """Add two numbers and return the result."""
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result
    
    def subtract(self, a: float, b: float) -> float:
        """Subtract b from a and return the result."""
        result = a - b
        self.history.append(f"{a} - {b} = {result}")
        return result
    
    def multiply(self, a: float, b: float) -> float:
        """Multiply two numbers and return the result."""
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result
    
    def divide(self, a: float, b: float) -> float:
        """Divide a by b and return the result."""
        if b == 0:
            raise ValueError("Cannot divide by zero")
        result = a / b
        self.history.append(f"{a} / {b} = {result}")
        return result
    
    def get_history(self) -> list:
        """Return the calculation history."""
        return self.history.copy()
    
    def clear_history(self) -> None:
        """Clear the calculation history."""
        self.history.clear()

def create_calculator() -> Calculator:
    """Factory function to create a new calculator instance."""
    return Calculator()

def main():
    """Main function to demonstrate calculator usage."""
    calc = create_calculator()
    
    # Perform some calculations
    result1 = calc.add(10.5, 5.2)
    result2 = calc.multiply(result1, 2)
    result3 = calc.divide(result2, 3)
    
    print(f"Final result: {result3}")
    print("History:")
    for entry in calc.get_history():
        print(f"  {entry}")

if __name__ == "__main__":
    main()