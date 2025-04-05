import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../..'); // Project root directory (one level up from dev folder)
const devDir = __dirname; // Dev directory where the script is located
const sourceDir = path.join(rootDir, 'src'); // Directory containing your source files
const testDir = path.join(rootDir, 'tests'); // Directory containing your test files to exclude
const outputFile = path.join(devDir, '../current_code.txt'); // Output file name with .txt extension in dev folder
//const additionalFiles = ['server.js', 'vite.config.js', '.env', 'package.json']; // Files in root directory to include

// Add an array of extensions to exclude from content combination (including the dot)
const excludedExtensions = ['.log', '.map', '.DS_Store', '.ttf', '.ico']; // Add any extensions you want to exclude

// Add array of directories to exclude (relative to root)
const excludedDirs = ['tests']; // Directory names to exclude

// This function gets all files for content combination
async function getFiles(dir, fileList = [], basePath = rootDir) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.relative(basePath, filePath);
    const stat = await fs.stat(filePath);
    
    // Skip excluded directories
    if (stat.isDirectory()) {
      // Check if this directory should be excluded
      const dirName = path.basename(filePath);
      const relativeDir = path.relative(rootDir, filePath);
      
      // Skip if the directory is in the excludedDirs array or is the test directory
      if (excludedDirs.includes(dirName) || filePath === testDir) {
        console.log(`Skipping excluded directory: ${relativePath}`);
        continue;
      }
      
      await getFiles(filePath, fileList, basePath);
    } else {
      // Only check exclusions for file content combination
      const fileExt = path.extname(file);
      if (!excludedExtensions.includes(fileExt)) {
        fileList.push(relativePath);
      }
    }
  }

  return fileList;
}

// The tree generation remains unchanged, using the original directory-tree-ascii command
// This will show ALL files, including the excluded ones
async function getFolderTree() {
  try {
    // Note: We're only excluding node_modules and .git here, not our excludedExtensions
    const { stdout } = await execAsync('npx directory-tree-ascii . -b node_modules .git', { cwd: rootDir });
    return stdout;
  } catch (error) {
    console.error('Failed to generate folder tree:', error);
    return '';
  }
}

async function combineFiles() {
  let files = await getFiles(sourceDir);
  
  // The tree will show all files, including excluded ones
  let combinedContent = '/** Folder layout\n * cmd: npx directory-tree-ascii . -b node_modules .git\n';
  combinedContent += await getFolderTree();
  combinedContent += '*/\n\n';

  // But only non-excluded files will have their content combined
  for (const file of files) {
    const filePath = path.join(rootDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const fileContent = content.trim(); // Trim whitespace from the start and end
    
    // Always add the relative path comment
    combinedContent += `\n// ${file}\n\n`;
    combinedContent += `${fileContent}\n\n`;
  }

  // Always overwrite the base_code.txt file
  await fs.writeFile(outputFile, combinedContent);
  console.log(`Combined ${files.length} files into ${outputFile} (overwritten if it existed)`);
  console.log(`Note: Excluded file types (${excludedExtensions.join(', ')}) appear in the tree but their content is not included.`);
  console.log(`Note: Excluded directories (${excludedDirs.join(', ')}) appear in the tree but their content is not included.`);
}

combineFiles().catch(console.error);