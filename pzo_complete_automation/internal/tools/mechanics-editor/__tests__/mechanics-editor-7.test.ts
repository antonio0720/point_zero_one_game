import * as assert from 'assert';
import { MechanicsEditor } from '../../../src/mechanics-editor';
import { MechanicsEditorDocument } from '../../../src/documents/mechanics-editor-document';
import { MechanicsEditorContent } from '../../../src/contents/mechanics-editor-content';
import { Component, IComponentData } from '../../../src/components/component';
import { ButtonComponent } from '../../../src/examples/button-example/button-component';
import { TextComponent } from '../../../src/examples/text-example/text-component';
import { IMechanicsEditorComponentConfiguration, MechanicsEditorComponentRegistry } from '../../../src/contents/mechanics-editor-content';

describe('Mechanics Editor', () => {
let editor: MechanicsEditor;
let document: MechanicsEditorDocument;
let content: MechanicsEditorContent;

beforeEach(() => {
editor = new MechanicsEditor();
document = new MechanicsEditorDocument('Test Document');
content = new MechanicsEditorContent(document);
});

it('should create an instance of MechanicsEditor', () => {
const me = new MechanicsEditor();
assert.ok(me);
});

it('should create an instance of MechanicsEditorDocument', () => {
const doc = new MechanicsEditorDocument('Test Document');
assert.ok(doc);
});

it('should create an instance of MechanicsEditorContent', () => {
const cont = new MechanicsEditorContent(document);
assert.ok(cont);
});

describe('Component Registration', () => {
beforeEach(() => {
MechanicsEditorComponentRegistry.registerComponent('Button', ButtonComponent, {} as IMechanicsEditorComponentConfiguration);
MechanicsEditorComponentRegistry.registerComponent('Text', TextComponent, {} as IMechanicsEditorComponentConfiguration);
});

it('should register a component', () => {
const button = Component.create('Button');
assert.ok(button instanceof ButtonComponent);
});

it('should register a text component', () => {
const text = Component.create('Text');
assert.ok(text instanceof TextComponent);
});
});
});
