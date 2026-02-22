import { BatchOperations } from "../../../src/utils/BatchOperations";
import { DocumentManager } from "@ckeditor/ckeditor5-engine";
import { EngineInitOptions } from "@ckeditor/ckeditor5-core";
import { EditorView, View, TextBuffer } from "@ckeditor/ckeditor5-view";
import { Paragraph } from "@ckeditor/ckeditor5-paragraph";
import { TestUtils } from "@ckeditor/ckeditor5-dev-utils";

describe('BatchOperations', () => {
let editorView: EditorView;
let document: DocumentManager;
let operations: BatchOperations;

beforeEach(() => {
document = new DocumentManager();
editorView = new EditorView({
document,
editableElement: document.createEditableElement(),
engine: createEngine()
});
editorView.setModel(document.createModel());
operations = new BatchOperations(editorView);
});

it('should perform replace operations correctly', () => {
// Setup the initial content
const initialContent = '<p>Old text</p><p>Another old text</p>';
document.setData(initialContent);

// Perform replace operations
operations.replace('Old text', 'New text 1');
operations.replace('Another old text', 'New text 2');

const expectedContent = '<p>New text 1</p><p>New text 2</p>';
expect(document.getData()).toEqual(expectedContent);
});

it('should perform remove operations correctly', () => {
// Setup the initial content
const initialContent = '<p>Old text</p><p>Another old text</p>';
document.setData(initialContent);

// Perform remove operations
operations.remove(2, 9); // Remove "Another" from "Another old text"
operations.remove(14, 4); // Remove "text" from the last "Old text"

const expectedContent = '<p>Old </p><p>old</p>';
expect(document.getData()).toEqual(expectedContent);
});

it('should perform insert operations correctly', () => {
// Setup the initial content
const initialContent = '<p>Old text</p>';
document.setData(initialContent);

// Perform insert operations
operations.insert('New text ', 1, 0);
operations.insert('\n<p>More new text</p>', 6, 12);

const expectedContent = '<p>New text Old text</p>\n<p>More new text</p>';
expect(document.getData()).toEqual(expectedContent);
});

function createEngine(): EngineInitOptions {
return {
plugins: [Paragraph],
schema: TestUtils.createEmptySchema(),
language: 'en'
};
}
});
