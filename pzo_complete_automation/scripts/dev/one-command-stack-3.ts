import * as path from 'path';
import * as webpack from 'webpack';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as SubstrateNetwork from '@substrate/polkadot-config';
import * as dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const networkName = process.env.NETWORK || 'local';
const chainId = parseInt(process.env.CHAIN_ID || '1337');

const nodeUrl = SubstrateNetwork.createAllegheny().toString();
if (networkName !== 'allegheny') {
throw new Error(`Unsupported network: ${networkName}`);
}

const config: webpack.Configuration = {
mode: isProduction ? 'production' : 'development',
target: 'web',
entry: './src/index.ts',
output: {
path: path.join(__dirname, 'dist'),
filename: 'bundle.js',
publicPath: '/',
clean: true,
},
devtool: isProduction ? 'source-map' : 'inline-source-map',
resolve: {
extensions: ['.ts', '.js', '.json'],
alias: {
'@': path.resolve(__dirname, 'src/'),
'@polkadot': path.join(__dirname, 'node_modules', '@polkadot'),
},
},
module: {
rules: [
{
test: /\.tsx?$/,
use: 'ts-loader',
exclude: /node_modules/,
},
{
test: /\.(css|scss)$/,
use: ['style-loader', 'css-loader', 'sass-loader'],
},
{
test: /\.(eot|svg|ttf|woff|woff2|otf)$/i,
type: 'asset/resource',
},
],
},
plugins: [
new webpack.DefinePlugin({
'process.env': {
NODE_ENV: JSON.stringify(isProduction ? 'production' : 'development'),
},
}),
new HtmlWebpackPlugin({
template: './public/index.html',
inject: true,
}),
new CopyWebpackPlugin({
patterns: [
{ from: './public', to: './' },
{
from: './node_modules/@polkadot-js/api/promise',
to: './dist/promise.min.js',
force: true,
copyUnmodified: true,
},
],
}),
].filter(Boolean),
devServer: {
contentBase: path.join(__dirname, 'dist'),
compress: true,
port: 8080,
open: true,
historyApiFallback: true,
clientLogLevel: 'info',
watchOptions: {
ignored: /node_modules/,
},
devMiddleware: {
publicPath: '/',
stats: 'minimal',
server: {
headers: {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'Content-Type',
},
websockets: true,
},
},
},
};

if (!isProduction) {
config.devtool = 'eval-cheap-module-source-map';
}

export default config;
