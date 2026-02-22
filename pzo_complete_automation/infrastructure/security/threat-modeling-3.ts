class Sanitizer {
static escapeHtml(html: string): string {
return html
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/\\/"/g, '&quot;')
.replace(/'/g, '&#039;');
}

static isValidInput(input: any): boolean {
// Custom validation logic for your web application
// For example, you can check if the input is a string and its length is within certain bounds.
return typeof input === 'string' && input.length <= 100;
}
}

class Application {
constructor(private sanitizer: Sanitizer) {}

handleInput(input: any): void {
if (this.sanitizer.isValidInput(input)) {
console.log(this.sanitizer.escapeHtml(input));
} else {
console.error('Invalid input');
}
}
}

const sanitizer = new Sanitizer();
const app = new Application(sanitizer);
app.handleInput('<h1>Hello, World!</h1>'); // Output: &lt;h1&gt;Hello, World!&lt;/h1&gt;
