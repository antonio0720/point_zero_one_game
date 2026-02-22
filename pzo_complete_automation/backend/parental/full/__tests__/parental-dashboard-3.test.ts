import React from 'react';
import { shallow, mount } from 'enzyme';
import ParentalDashboard, { mapStateToProps, mapDispatchToProps } from '../parental-dashboard';
import AgeGating from '../../age-gating';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

const mockStore = configureStore();

describe('Parental controls + age gating - parental-dashboard', () => {
let store, wrapper;

beforeEach(() => {
const initialState = {
user: {},
settings: {},
auth: {}
};
store = mockStore(initialState);
wrapper = shallow(<ParentalDashboard />).dive().dive();
});

it('renders AgeGating component', () => {
expect(wrapper.find(AgeGating)).toHaveLength(1);
});

describe('with connected components', () => {
beforeEach(() => {
wrapper = mount(<Provider store={store}>
<ParentalDashboard />
</Provider>);
});

it('matches snapshot', () => {
expect(wrapper).toMatchSnapshot();
});

describe('mapStateToProps', () => {
it('should map the correct state to props', () => {
const expectedProps = {}; // Add your expected props here
const mappedProps = mapStateToProps(store.getState());
expect(mappedProps).toEqual(expectedProps);
});
});

describe('mapDispatchToProps', () => {
it('should map the correct dispatch to props', () => {
const mockActions = {}; // Add your mock actions here
const mappedProps = mapDispatchToProps(dispatch => ({
...mockActions,
}));
expect(mappedProps).toEqual(expect.objectContaining(mockActions));
});
});
});
});
