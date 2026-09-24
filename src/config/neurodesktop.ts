// Stable Neurodesktop release used across the documentation. Pages import this
// constant for docker commands, the release history and citation examples.
// Renovate opens a PR to bump it when a new neurodesk/neurodesktop release ships.

export const jupyterNeurodeskVersion = '2026-09-23';

export const ports = {
	rdp: '-p 3390:3389',
	vnc: '-p 5901:5901',
	vncFlag: '--vnc',
} as const;
