#!/usr/bin/env node

import { Command } from 'commander';
import { execa } from 'execa';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .version('1.0.0')
  .description('A CLI tool to interact with multiple AI models simultaneously.');

program
  .command('chat')
  .description('Start a new chat session with the AI models.')
  .action(async () => {
    console.log(chalk.bold.green('Welcome to BudoAI!'));
    console.log('You can start chatting with the AI models.\n');

    let models;
    try {
      models = JSON.parse(await fs.readFile(path.join(__dirname, 'models.json'), 'utf-8'));
    } catch (error) {
      console.error(chalk.red('Error: Could not read or parse models.json.'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }

    const chat = async () => {
      const { prompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: 'You:',
        },
      ]);

      if (prompt.toLowerCase() === 'exit') {
        console.log(chalk.bold.red('Goodbye!'));
        return;
      }

      const promises = models.map(model => {
        return new Promise(async (resolve) => {
          try {
            const child = execa(model.command, { input: prompt });
            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
              output += data.toString();
            });

            child.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });

            await child;

            if (errorOutput) {
              resolve({ name: model.name, color: model.color, response: chalk.red(`Error: ${errorOutput}`) });
            } else {
              resolve({ name: model.name, color: model.color, response: output });
            }
          } catch (error) {
            resolve({ name: model.name, color: model.color, response: chalk.red(`Execution Error: ${error.message}`) });
          }
        });
      });

      const results = await Promise.all(promises);

      console.log('\n');
      results.forEach(result => {
        const colorizer = result.color.startsWith('#') ? chalk.hex(result.color) : chalk[result.color];
        console.log(colorizer.bold(`${result.name}:`));
        console.log(result.response);
      });

      const choices = results.map(result => ({ name: `${result.name}'s response`, value: result.name }));
      const { vote } = await inquirer.prompt([
        {
          type: 'list',
          name: 'vote',
          message: 'Which response is the best?',
          choices: [...choices, { name: 'None of the above', value: 'none' }],
        },
      ]);

      console.log(chalk.bold.yellow(`You voted for: ${vote}\n`));

      chat();
    };

    chat();
  });

program.parse(process.argv);
