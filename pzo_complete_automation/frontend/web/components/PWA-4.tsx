import React from 'react';
import { IconButton } from '@material-ui/core';
import AddShoppingCartIcon from '@material-ui/icons/AddShoppingCart';
import { useDispatch, useSelector } from 'react-redux';
import { incrementCart } from '../../store/actions';

const PWA4 = () => {
const dispatch = useDispatch();
const cartCount = useSelector(state => state.cart.count);

return (
<IconButton onClick={() => dispatch(incrementCart())}>
<AddShoppingCartIcon />
<span className="badge">{cartCount}</span>
</IconButton>
);
};

export default PWA4;
