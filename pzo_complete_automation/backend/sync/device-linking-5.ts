// {
//   uid: 'user123',
//   tokens: ['token1', 'token2'],
//   currentToken: 'token1' // or null if no active session
// }

function storeTokenMapping(userId, deviceLinkingToken) {
const tokenMappingRef = doc(tokenToUserMappingRef, deviceLinkingToken);
setDoc(tokenMappingRef, { userId });
}

async function getUserFromToken(deviceLinkingToken: string): Promise<string | null> {
const tokenMappingRef = doc(tokenToUserMappingRef, deviceLinkingToken);
const userSnapshot = await getDoc(tokenMappingRef);
return userSnapshot.exists() ? userSnapshot.data().userId : null;
}

function updateCurrentToken(userId: string, newCurrentToken: string) {
const userRef = doc(db, 'users', userId);
return updateDoc(userRef, { currentToken: newCurrentToken });
}
```
