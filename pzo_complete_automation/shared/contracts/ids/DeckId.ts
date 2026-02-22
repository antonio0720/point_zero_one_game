type DeckId = string;

const validateDeckId = (id: DeckId): boolean => {
const regex = /^[a-zA-Z0-9]{8}$/;
return regex.test(id);
};

const generateDeckId = () => {
let result = '';
const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
for (let i = 0; i < 8; i++) {
result += characters.charAt(Math.floor(Math.random() * characters.length));
}
return result;
};

const DeckId = {
validate: validateDeckId,
generate: generateDeckId,
};

export default DeckId;
