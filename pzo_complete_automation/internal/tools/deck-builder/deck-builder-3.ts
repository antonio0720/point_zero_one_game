import * as React from 'react';
import { Card } from './Card';
import { DeckProvider } from './DeckContext';
import { Button, List } from 'antd';

interface Props {}

interface State {
deck: any[];
}

class DeckBuilder extends React.Component<Props, State> {
state = {
deck: [],
};

addCardToDeck = (card: any) => {
this.setState({
deck: [...this.state.deck, card],
});
};

render() {
return (
<DeckProvider value={{ deck: this.state.deck }}>
<List grid={{ gutter: 16, column: 4 }} size="small">
<List.Item>
<Card onClick={() => this.addCardToDeck({ id: '1', name: 'Card 1' })} />
</List.Item>
<List.Item>
<Card onClick={() => this.addCardToDeck({ id: '2', name: 'Card 2' })} />
</List.Item>
{/* Add more cards here */}
</List>
<div style={{ textAlign: 'center' }}>
<Button type="primary">Build Deck</Button>
</div>
</DeckProvider>
);
}
}

export default DeckBuilder;
