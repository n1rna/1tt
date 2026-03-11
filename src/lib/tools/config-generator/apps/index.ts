import type { AppDefinition } from "../types";
import { tsconfig } from "./tsconfig";
import { eslint } from "./eslint";
import { prettier } from "./prettier";
import { nginx } from "./nginx";
import { gitignore } from "./gitignore";
import { kitty } from "./kitty";
import { alacritty } from "./alacritty";
import { ohmyzsh } from "./ohmyzsh";
import { zellij } from "./zellij";
import { bitcoin } from "./bitcoin";
import { ssh } from "./ssh";
import { nextconfig } from "./nextconfig";
import { tmux } from "./tmux";

export const apps: AppDefinition[] = [
  tsconfig,
  eslint,
  prettier,
  nginx,
  gitignore,
  kitty,
  alacritty,
  ohmyzsh,
  zellij,
  bitcoin,
  ssh,
  nextconfig,
  tmux,
];

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}

export { tsconfig, eslint, prettier, nginx, gitignore, kitty, alacritty, ohmyzsh, zellij, bitcoin, ssh, nextconfig, tmux };
