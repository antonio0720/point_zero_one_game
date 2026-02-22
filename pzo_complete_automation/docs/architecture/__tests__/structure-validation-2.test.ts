import { readDirSync } from 'fs';
import { join } from 'path';
import { Equal, Expect } from '@type-challenges/utils';
import { SourceOfTruthTree, TreeNode, createSourceOfTruthTree } from './source-of-truth-tree';

interface Package {
name: string;
path: string;
}

const rootDir = process.cwd();
const packagesDir = join(rootDir, 'packages');

function getPackages(): Package[] {
return readDirSync(packagesDir).map((dir) => ({
name: dir,
path: join(packagesDir, dir),
}));
}

function createSourceOfTruthTrees(packages: Package[]) {
return packages.map((pkg) => createSourceOfTruthTree(pkg.path));
}

function areSourceOfTruthTreesEqual<T extends TreeNode>(
tree1: T,
tree2: T
): Equal<Exclude<keyof T, 'children' | 'name'>, Exclude<keyof T, 'children' | 'name'>[]> {
return Expect<
Equal<
Exclude<keyof T, 'children' | 'name'>,
Exclude<keyof T, 'children' | 'name'>[]
>
>.True;
}

describe('SourceOfTruthTrees', () => {
const packages = getPackages();
const sourceOfTruthTrees = createSourceOfTruthTrees(packages);

it('should have equal structure for all packages', () => {
const firstTreeStructure = sourceOfTruthTrees[0].structure;

sourceOfTruthTrees.slice(1).forEach((tree) => {
expect(areSourceOfTruthTreesEqual(firstTreeStructure, tree.structure)).toBe(true);
});
});
});
