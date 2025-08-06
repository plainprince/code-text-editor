// Test file for outline functionality with proper nesting
class TestClass {
  constructor(name) {
    this.name = name;
  }
  
  getName() {
    return this.name;
  }
  
  setName(newName) {
    this.name = newName;
  }
  
  static createDefault() {
    return new TestClass('default');
  }
}

class AnotherClass {
  constructor() {
    this.data = {};
  }
  
  addData(key, value) {
    this.data[key] = value;
  }
  
  getData(key) {
    return this.data[key];
  }
}

function globalFunction() {
  console.log('Global function');
}

const arrow = () => {
  return 'arrow function';
};

const obj = {
  method() {
    return 'object method';
  },
  
  prop: 'property'
};