import * as React from 'react';
import { Component } from 'react';
import * as PropTypes from 'prop-types';
import * as T from 'lodash';
import classNames from 'classnames';
import Draggable from 'react-draggable';
import { connect } from 'react-redux';
import { Panel, Icon, MenuItem } from '@blueprintjs/core';
import { RootState } from '../store';
import { IAction, ActionTypes } from '../actions';
import { IEditorStore, ICard, ICards, IDeck, IToolState, ITileData, ILayer, IGrid, IMechanic, IComponent } from '../types';
import { getCardsByType, getSelectedCards, getSelectedTiles, getDraggingCard, getTileCount, isDragging, getLayerById, getGridById, getEditorState, getDeckByIndex, getActiveDeck, getActiveTool, getMechanicByType, getComponentByType, findComponentsContaining, findComponentByType, findTilesContaining, findTilesByType, findCardsByType } from '../selectors';
import { addCard, removeCard, selectCard, deselectAllCards, setDraggingCard, setActiveTool, toggleLock, changeLayerOrder, updateComponent, updateTileData, updateGrid, createDeck, deleteDeck, selectDeck, activateDeck, updateMechanic, addComponent, removeComponent } from '../actions';
import { EditorCanvas, Layer, Grid, Tile, Card, LockIcon, ArrowDownIcon, ArrowUpIcon, DeleteIcon, AddCardButton, MoveUpButton, MoveDownButton, LockPanel, CardList, DeckSelector, ToolSelector, MechanicEditorToolbar, CardEditorToolbar } from './';
import styles from './MechanicsEditor.module.scss';

class MechanicsEditor extends Component<IToolState> {
static propTypes = {
cards: PropTypes.shape({}).isRequired,
tiles: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
decks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
activeDeck: PropTypes.number.isRequired,
activeTool: PropTypes.oneOf([ActionTypes.Card, ActionTypes.Component, ActionTypes.Mechanic]).isRequired,
activeLayer: PropTypes.number.isRequired,
activeGrid: PropTypes.number.isRequired,
draggingCard: PropTypes.shape({}).isRequired,
grid: PropTypes.shape({}),
layer: PropTypes.shape({}),
lock: PropTypes.bool,
mechanic: PropTypes.shape({}).isRequired,
components: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

render() {
const { cards, tiles, decks, activeDeck, activeTool, activeLayer, activeGrid, draggingCard, grid, layer, lock, mechanic, components } = this.props;

return (
<div className={styles.mechanicsEditor}>
<Panel>
<MechanicEditorToolbar />
<ToolSelector />
<DeckSelector />
</Panel>
<Draggable handle=".bp3-toolbar" defaultPosition={{ x: 0, y: 0 }} position={null}>
<div className={styles.editor}>
<LockPanel />
<EditorCanvas>
{layers.map((layer, index) => (
<Layer key={index} layer={layer} active={activeLayer === index} onClick={() => this.props.setActiveTool(ActionTypes.Card)}>
<Grid id={grid[index].id} className={styles.grid}>
{tiles[index].map((tile, tileIndex) => (
<Tile key={tileIndex} tile={tile} onClick={() => this.props.setDraggingCard(tile)}>
<Card cards={cards} componentType={componentTypes[tile.type]} mechanic={mechanic} lock={lock} />
</Tile>
))}
</Grid>
</Layer>
))}
</EditorCanvas>
<CardEditorToolbar />
</div>
</Draggable>
{activeTool === ActionTypes.Mechanic && (
<Panel className={styles.mechanicEditor}>
<MenuItem icon="add" text="+ Add Mechanic" onClick={() => this.props.updateMechanic({ ...mechanic, name: mechanicNameInputRef.current.value })} />
{mechanics.map((mechanic) => (
<MenuItem key={mechanic.id} icon="delete" text={mechanic.name} onClick={() => this.props.removeMechanic(mechanic.id)} />
))}
</Panel>
)}
{activeTool === ActionTypes.Component && (
<Panel className={styles.componentEditor}>
<MenuItem icon="add" text="+ Add Component" onClick={() => this.props.addComponent({ type: componentTypeInputRef.current.value, mechanicId: mechanic.id })} />
{components.map((component) => (
<MenuItem key={component.id} icon="delete" text={component.name} onClick={() => this.props.removeComponent(component.id)} />
))}
</Panel>
)}
</div>
);
}
}

const mapStateToProps = (state: RootState) => ({
cards: getCardsByType(state, CardTypes.MECHANIC),
tiles: getSelectedTiles(state),
decks: state.decks,
activeDeck: getActiveDeck(state),
activeTool: getActiveTool(state),
activeLayer: getLayerById(state, activeLayerId),
activeGrid: getGridById(state, activeGridId),
draggingCard: getDraggingCard(state),
grid: getGridById(state, activeGridId),
layer: getLayerById(state, activeLayerId),
lock: state.lock,
mechanic: getMechanicByType(state, MechanicTypes.DEFAULT),
components: findComponentsContaining(state, draggingCard ? { id: draggingCard.id } : null),
});

const mapDispatchToProps = (dispatch) => ({
addCard: (card: ICard) => dispatch(addCard(card)),
removeCard: (card: ICard) => dispatch(removeCard(card)),
selectCard: (card: ICard) => dispatch(selectCard(card)),
deselectAllCards: () => dispatch(deselectAllCards()),
setDraggingCard: (card: ITileData) => dispatch(setDraggingCard(card)),
setActiveTool: (tool: ActionTypes) => dispatch(setActiveTool(tool)),
toggleLock: () => dispatch(toggleLock()),
changeLayerOrder: (fromIndex: number, toIndex: number) => dispatch(changeLayerOrder(activeDeck, fromIndex, toIndex)),
updateComponent: (component: IComponent) => dispatch(updateComponent(component)),
updateTileData: (tile: ITileData) => dispatch(updateTileData(tile)),
updateGrid: (grid: IGrid) => dispatch(updateGrid(grid)),
createDeck: () => dispatch(createDeck()),
deleteDeck: (index: number) => dispatch(deleteDeck(index)),
selectDeck: (index: number) => dispatch(selectDeck(index)),
activateDeck: (index: number) => dispatch(activateDeck(index)),
updateMechanic: (mechanic: IMechanic) => dispatch(updateMechanic(mechanic)),
addComponent: (component: IComponent) => dispatch(addComponent(component)),
removeComponent: (id: number) => dispatch(removeComponent(id)),
});

export default connect(mapStateToProps, mapDispatchToProps)(MechanicsEditor);
