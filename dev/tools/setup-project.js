// scripts/setup-project.js
import { validate } from '@marko/compiler/babel-types';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const baseDir = process.cwd();

const structure = {
  src: {
    core: {
      container: {},
      errors:{},
      events: {},
      validation:{},
      config: {},
      services: {
        cache: {},
        config: {},
        database: {},
        filesystem: {},
        logger: {},
        metrics: {},
        scheduler: {},
        telemetry: {},
        validation: {}
      },

    }
  },
  tests: {
    core: {
      container: {},
      errors: {
        types: {}
      },
      events: {},
      services: {
        cache: {},
        config: {},
        database: {},
        filesystem: {},
        logger: {},
        metrics: {},
        scheduler: {},
        telemetry: {},
        validation: {}
      }
    },
    integration: {},
    fixtures: {}
  },
  scripts: {},
  docs: {}
};

async function createDirectory(path) {
  try {
    await mkdir(path, { recursive: true });
    console.log(`Created directory: ${path}`);
  } catch (error) {
    console.error(`Error creating directory ${path}:`, error);
  }
}

async function createGitKeep(path) {
  try {
    await writeFile(join(path, '.gitkeep'), '');
    console.log(`Created .gitkeep in: ${path}`);
  } catch (error) {
    console.error(`Error creating .gitkeep in ${path}:`, error);
  }
}

async function createDirectoryStructure(structure, currentPath) {
  for (const [name, subStructure] of Object.entries(structure)) {
    const newPath = join(currentPath, name);
    await createDirectory(newPath);
    
    // Add .gitkeep to empty directories
    if (Object.keys(subStructure).length === 0) {
      await createGitKeep(newPath);
    }
    
    // Recursively create subdirectories
    await createDirectoryStructure(subStructure, newPath);
  }
}

// Root level files
const rootFiles = [
  'README.md'
];

async function createRootFiles() {
  for (const file of rootFiles) {
    try {
      await writeFile(join(baseDir, file), '');
      console.log(`Created file: ${file}`);
    } catch (error) {
      console.error(`Error creating file ${file}:`, error);
    }
  }
}

async function main() {
  console.log('Setting up project structure...');
  await createDirectoryStructure(structure, baseDir);
  await createRootFiles();
  console.log('Project structure setup complete!');
}

main().catch(console.error);