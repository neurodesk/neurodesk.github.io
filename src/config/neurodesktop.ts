// Mirrors data/neurodesktop.toml in the Hugo source.
// Update the version here when bumping Neurodesktop releases.

export const jupyterNeurodeskVersion = '2026-07-11';

export const ports = {
	rdp: '-p 3390:3389',
	vnc: '-p 5901:5901',
	vncFlag: '--vnc',
} as const;
