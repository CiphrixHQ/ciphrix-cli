#!/usr/bin/env node
import { main } from './cli.js';

const exitCode = await main(process.argv);
process.exitCode = exitCode;
