import fs from 'fs';

const path = './oclif.manifest.json';
const manifest = JSON.parse(fs.readFileSync(path, 'utf-8'));

const sortedCommands = Object.keys(manifest.commands)
  .sort()
  .reduce((acc: any, key: string) => {
    acc[key] = manifest.commands[key];
    return acc;
  }, {});

manifest.commands = sortedCommands;

fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
console.log('✅ Sorted oclif.manifest.json');
