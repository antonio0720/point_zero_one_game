function safeEval(code: string) {
const sandbox = new Sandbox();
sandbox.eval(code);
return sandbox.result;
}

class Sandbox {
private _context: any;

constructor() {
this._context = {};
}

eval(code: string) {
(new Function("return " + code))().bind(this._context)();
return this;
}

get result() {
return this._context;
}
}
