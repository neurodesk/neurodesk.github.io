/**
 * Data model for the Getting Started setup chooser. Axes, support rules and
 * outcomes are declared separately, so a combination is matched, not enumerated.
 */

export type AxisId = 'platform' | 'os' | 'interface' | 'processor';

export interface AxisOption {
	id: string;
	label: string;
}

export interface Axis {
	id: AxisId;
	label: string;
	options: AxisOption[];
}

export const axes: Axis[] = [
	{
		id: 'platform',
		label: 'Compute platform',
		options: [
			{ id: 'local', label: 'Local PC' },
			{ id: 'hpc', label: 'HPC' },
			{ id: 'cloud', label: 'Cloud' },
			{ id: 'colab', label: 'Google Colab' },
		],
	},
	{
		id: 'os',
		label: 'Your OS',
		options: [
			{ id: 'linux', label: 'Linux' },
			{ id: 'macos', label: 'Mac' },
			{ id: 'windows', label: 'Windows' },
		],
	},
	{
		id: 'interface',
		label: 'Interface',
		options: [
			{ id: 'gui', label: 'Desktop' },
			{ id: 'cmd', label: 'Command line' },
			{ id: 'container', label: 'Container' },
			{ id: 'vscode', label: 'VS Code' },
		],
	},
	{
		id: 'processor',
		label: 'Processor',
		options: [
			{ id: 'x86', label: 'x86' },
			{ id: 'arm', label: 'ARM' },
			{ id: 'gpu', label: 'GPU' },
		],
	},
];

/** What an option is compatible with. An axis left out is unconstrained. */
export type Constraint = Partial<Record<AxisId, string[]>>;

export const constraints: Record<string, Constraint> = {
	// Colab only ever gives you a container.
	gui: { platform: ['local', 'hpc', 'cloud'] },
	cmd: { platform: ['local', 'hpc', 'cloud'] },
	vscode: { platform: ['local', 'hpc', 'cloud'] },
	// ARM is local desktop only.
	arm: { platform: ['local'], os: ['linux', 'macos'], interface: ['gui'] },
};

export const defaults: Record<AxisId, string> = {
	platform: 'local',
	os: 'linux',
	interface: 'gui',
	processor: 'x86',
};

/**
 * Axes that drive a Starlight synced-tab group. Keyed by tab LABEL TEXT, so
 * these must match the MDX exactly; SetupChooser.astro checks that at build
 * time. Values with no entry (container, vscode) have no tab group.
 */
export const syncedTabs: Partial<
	Record<AxisId, { syncKey: string; labels: Record<string, string> }>
> = {
	os: {
		syncKey: 'os',
		labels: { linux: 'Linux', macos: 'macOS', windows: 'Windows' },
	},
	interface: {
		syncKey: 'install-method',
		labels: { gui: 'Neurodesk App (recommended)', cmd: 'Terminal' },
	},
};

/** Storage key prefix Starlight's synced tabs use. Internal to Starlight. */
export const TAB_STORE_PREFIX = 'starlight-synced-tabs__';

export interface OutcomeCard {
	title: string;
	description: string;
	href: string;
}

export interface Outcome {
	id: string;
	/** Every listed axis must contain the current selection for this to show. */
	when: Constraint;
	cards: OutcomeCard[];
}

/** Additive: every matching entry renders, so GPU and ARM layer extra cards. */
export const outcomes: Outcome[] = [
	{
		id: 'app',
		when: { interface: ['gui'], platform: ['local'] },
		cards: [
			{
				title: 'Neurodesk App',
				description:
					'Cross-platform desktop installer that manages the container for you. The recommended starting point.',
				href: '/getting-started/app/neurodeskapp/',
			},
		],
	},
	{
		id: 'desktop-linux',
		when: { interface: ['gui'], platform: ['local'], os: ['linux'] },
		cards: [
			{
				title: 'Neurodesktop on Linux',
				description: 'Run the container yourself with Docker or Podman.',
				href: '/getting-started/neurodesktop/linux/',
			},
		],
	},
	{
		id: 'desktop-macos',
		when: { interface: ['gui'], platform: ['local'], os: ['macos'] },
		cards: [
			{
				title: 'Neurodesktop on Mac',
				description: 'Run the container yourself with Docker Desktop.',
				href: '/getting-started/neurodesktop/mac/',
			},
		],
	},
	{
		id: 'desktop-windows',
		when: { interface: ['gui'], platform: ['local'], os: ['windows'] },
		cards: [
			{
				title: 'Neurodesktop on Windows',
				description: 'Run the container yourself with Docker Desktop and WSL2.',
				href: '/getting-started/neurodesktop/windows/',
			},
		],
	},
	{
		id: 'desktop-cloud',
		when: { interface: ['gui', 'cmd', 'vscode'], platform: ['cloud'] },
		cards: [
			{
				title: 'Neurodesk Play',
				description: 'Free hosted Neurodesk in your browser. Nothing to install.',
				href: '/getting-started/hosted/play/',
			},
			{
				title: 'Host it yourself',
				description: 'Run Neurodesktop on your own cloud provider.',
				href: '/getting-started/neurodesktop/cloud/',
			},
			{
				title: 'Nectar Research Cloud',
				description: 'Hosted Neurodesk for Australian researchers.',
				href: '/getting-started/installations/nectar/',
			},
		],
	},
	{
		id: 'desktop-hpc',
		when: { interface: ['gui'], platform: ['hpc'] },
		cards: [
			{
				title: 'Neurocommand on Linux and HPC',
				description:
					'Install on a cluster, then reach the graphical interface over X11 forwarding.',
				href: '/getting-started/neurocommand/linux-and-hpc/',
			},
			{
				title: 'Worked cluster examples',
				description: 'Step-by-step setups for Bunya, Sherlock, Great Lakes and more.',
				href: '/getting-started/installations/',
			},
		],
	},
	{
		id: 'cmd-unix',
		when: { interface: ['cmd'], platform: ['local'], os: ['linux', 'macos'] },
		cards: [
			{
				title: 'Neurocommand',
				description: 'Command-line tool manager. Load applications as Lmod modules.',
				href: '/getting-started/neurocommand/linux-and-hpc/',
			},
		],
	},
	{
		id: 'cmd-windows',
		when: { interface: ['cmd'], platform: ['local'], os: ['windows'] },
		cards: [
			{
				title: 'Neurocommand on Windows',
				description: 'Command-line install for Windows.',
				href: '/getting-started/neurocommand/windows/',
			},
		],
	},
	{
		id: 'cmd-hpc',
		when: { interface: ['cmd'], platform: ['hpc'] },
		cards: [
			{
				title: 'Neurocommand on Linux and HPC',
				description: 'Install on a cluster and load applications as Lmod modules.',
				href: '/getting-started/neurocommand/linux-and-hpc/',
			},
			{
				title: 'Worked cluster examples',
				description: 'Step-by-step setups for Bunya, Sherlock, Great Lakes and more.',
				href: '/getting-started/installations/',
			},
		],
	},
	{
		id: 'container-standard',
		when: { interface: ['container'], platform: ['local', 'hpc', 'cloud'] },
		cards: [
			{
				title: 'Docker',
				description: 'Pull a single application container.',
				href: '/getting-started/neurocontainers/docker/',
			},
			{
				title: 'Singularity / Apptainer',
				description: 'Download a container image for rootless and HPC use.',
				href: '/getting-started/neurocontainers/singularity/',
			},
			{
				title: 'CVMFS',
				description: 'Mount every container on demand instead of downloading them.',
				href: '/getting-started/neurocontainers/cvmfs/',
			},
		],
	},
	{
		id: 'container-colab',
		when: { platform: ['colab'] },
		cards: [
			{
				title: 'Neurodesk in Google Colab',
				description: 'Set up Neurodesk containers inside a Colab notebook.',
				href: '/getting-started/hosted/google/',
			},
		],
	},
	{
		id: 'vscode',
		when: { interface: ['vscode'] },
		cards: [
			{
				title: 'Neurodesk in VS Code',
				description: 'Attach VS Code to a running Neurodesk container.',
				href: '/getting-started/neurocommand/visual-studio-code/',
			},
		],
	},
	{
		id: 'gpu-container',
		when: { processor: ['gpu'], interface: ['container'] },
		cards: [
			{
				title: 'GPU support in containers',
				description: 'Pass a GPU through to a Singularity or Apptainer container.',
				href: '/getting-started/neurocontainers/singularity/#singularity-containers-and-gpus',
			},
		],
	},
	{
		id: 'gpu-desktop',
		when: { processor: ['gpu'], interface: ['gui', 'cmd', 'vscode'] },
		cards: [
			{
				title: 'GPU support in Neurodesktop',
				description: 'Extra flags needed to expose an NVIDIA GPU to the container.',
				href: '/getting-started/neurodesktop/linux/#gpu-support',
			},
		],
	},
	{
		id: 'arm-linux',
		when: { processor: ['arm'], os: ['linux'] },
		cards: [
			{
				title: 'ARM64 on Linux',
				description:
					'Neurodesk runs on ARM64 through binfmt. Enable it once before starting the container.',
				href: '/getting-started/neurodesktop/linux/',
			},
		],
	},
	{
		id: 'arm-macos',
		when: { processor: ['arm'], os: ['macos'] },
		cards: [
			{
				title: 'Apple Silicon',
				description: 'Neurodesktop on an M-series Mac, including the emulation caveats.',
				href: '/getting-started/neurodesktop/mac/',
			},
		],
	},
];
