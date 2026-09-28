import { CLI_VERSION } from './constants.js';
import type { Theme } from './theme.js';

// Shown only for a bare `ciphrix` invocation, never for a command.
const BANNER_ART = [
  '   ██████╗██╗██████╗ ██╗  ██╗██████╗ ██╗██╗  ██╗',
  '  ██╔════╝██║██╔══██╗██║  ██║██╔══██╗██║╚██╗██╔╝',
  '  ██║     ██║██████╔╝███████║██████╔╝██║ ╚███╔╝ ',
  '  ██║     ██║██╔═══╝ ██╔══██║██╔══██╗██║ ██╔██╗ ',
  '  ╚██████╗██║██║     ██║  ██║██║  ██║██║██╔╝ ██╗',
  '   ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝',
].join('\n');

const TAGLINE = 'C i p h r i x   c o m p l i a n c e   C L I';

export const formatBanner = (theme: Theme): string =>
  [theme.cyan(theme.bold(BANNER_ART)), theme.dim(`${TAGLINE}  v${CLI_VERSION}`)].join('\n');
