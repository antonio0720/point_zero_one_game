import * as React from 'react';
import {
Card,
CardBody,
Button,
Input,
Table,
Thead,
Tbody,
Tr,
Th,
Td,
} from '@patternfly/react-core';

interface MechanicsEditorProps {
data: any;
onSave: (data: any) => void;
}

const MechanicsEditor: React.FC<MechanicsEditorProps> = ({ data, onSave }) => {
const [cardData, setCardData] = React.useState(data);

const handleInputChange = (event: React.FormEvent<HTMLInputElement>, key: string) => {
const { name, value } = event.currentTarget;
setCardData({ ...cardData, [key]: value });
};

const handleSaveClick = () => {
onSave(cardData);
};

return (
<Card>
<CardBody>
<Table variant="compact">
<Thead>
<Tr>
<Th></Th>
<Th>Key</Th>
<Th>Value</Th>
</Tr>
</Thead>
<Tbody>
{Object.entries(cardData).map(([key, value]) => (
<Tr key={key}>
<Td>
<Input type="text" name={key} value={value} onChange={(event) => handleInputChange(event, key)} />
</Td>
<Td>Key</Td>
<Td>{key}</Td>
</Tr>
))}
</Tbody>
</Table>
<Button variant="primary" onClick={handleSaveClick}>
Save
</Button>
</CardBody>
</Card>
);
};

export default MechanicsEditor;
