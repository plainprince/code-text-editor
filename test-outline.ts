// TypeScript test file for outline functionality
interface Person {
  name: string;
  age: number;
}

class TestClass implements Person {
  private _name: string;
  private _age: number;
  
  constructor(name: string, age: number) {
    this._name = name;
    this._age = age;
  }
  
  get name(): string {
    return this._name;
  }
  
  set name(value: string) {
    this._name = value;
  }
  
  get age(): number {
    return this._age;
  }
  
  set age(value: number) {
    this._age = value;
  }
  
  getName(): string {
    return this._name;
  }
  
  setName(newName: string): void {
    this._name = newName;
  }
  
  static createDefault(): TestClass {
    return new TestClass('default', 0);
  }
  
  private helperMethod(): void {
    console.log('Helper method');
  }
}

namespace TestNamespace {
  export class NestedClass {
    constructor(public value: string) {}
    
    getValue(): string {
      return this.value;
    }
  }
  
  export function namespaceFunction(): void {
    console.log('Namespace function');
  }
}

function globalFunction(param: string): void {
  console.log('Global function:', param);
}

const arrow = (x: number): number => {
  return x * 2;
};

enum Status {
  Active = 1,
  Inactive = 0,
  Pending = 2
}