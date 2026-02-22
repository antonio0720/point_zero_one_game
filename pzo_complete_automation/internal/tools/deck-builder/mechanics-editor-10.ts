import * as React from 'react';
import { useEffect } from 'react';
import styles from './mechanics-editor.module.css';
import { Editor, EditorState } from '@codemirror/editor';
import { json, yaml } from '@codemirror/lang-json';
import { syntaxHighlightDirectives, highlightStyle } from '@codemirror/highlight';
import { keymap, Placeholder, Tab, indentOnInput, autoCloseBrackets, closeBrackets, backspaceIndentUnit, indentWithTab, closeTags, autocomplete } from '@codemirror/lang-javascript';
import { history, RedoDecoration, UndoDecoration } from '@codemirror/view';
import { doc, text, paragraph, hardWrap, lineBreak } from '@codemirror/state';
import { CodeMirror } from '@uiw/react-codemirror';
import { useLocalStorage } from 'ahooks';
import { Button, Input, message, Popover, Space, Tooltip } from 'antd';
import { PlusOutlined, DownOutlined, UpOutlined, FileTextOutlined, SaveFilled, LoadedOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import { MechanicsFile } from '../types';
import { MechanicsSchema } from '../../schemas/mechanics';

const MECHANICS_FILE_KEY = 'mechanics-files';

function getInitialState() {
const file = localStorage.getItem(MECHANICS_FILE_KEY);
return file ? JSON.parse(file) : MechanicsSchema.getDefault();
}

function saveToLocalStorage(state: MechanicsFile) {
const jsonString = JSON.stringify(state, null, 2);
localStorage.setItem(MECHANICS_FILE_KEY, jsonString);
}

function handleSave() {
message.success('保存成功');
saveToLocalStorage(getEditorState());
}

function getEditorState(): MechanicsFile {
return EditorState.fromJSON(JSON.parse(localStorage.getItem(MECHANICS_FILE_KEY) || '{}'));
}

function MechanicsEditor() {
const [editorState, setEditorState] = useLocalStorage<MechanicsFile>(MECHANICS_FILE_KEY, getInitialState());
const [isLoading, setIsLoading] = React.useState(false);

useEffect(() => {
saveToLocalStorage(editorState);
}, [editorState]);

return (
<div className={styles.container}>
<div className={styles.toolbar}>
<Space>
<Button onClick={() => setEditorState(MechanicsSchema.getDefault())} icon={<CodeSandboxOutlined />}>
新建文件
</Button>
<Popover content="保存">
<Button onClick={handleSave} loading={isLoading} icon={<SaveFilled />}>
保存
</Button>
</Popover>
</Space>
</div>
<CodeMirror
value={JSON.stringify(editorState, null, 2)}
height="60vh"
extensions={[
syntaxHighlightDirectives(highlightStyle),
json(),
autoCloseBrackets(),
backspaceIndentUnit(),
indentOnInput(),
keymap.of([indentWithTab]),
closeTags(),
history(),
UndoDecoration,
RedoDecoration,
Tab,
Placeholder('json'),
lineBreak({ wrap: true }),
hardWrap(),
paragraph({ maxDepth: 10 }),
autocomplete()
]}
/>
</div>
);
}

export default MechanicsEditor;
