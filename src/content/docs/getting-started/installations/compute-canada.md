---
title: Compute Canada and Canadian HPC
description: Use Neurodesk modules on Canadian HPC systems and find Open OnDemand access.
sidebar:
  order: 7
---

Use Neurodesk tools on Canadian HPC systems through the site's container runtime and Neurodesk's CVMFS repository. Compute Canada is now the Digital Research Alliance of Canada. You need an account and access to your chosen cluster. For Toronto's Trillium system, follow [SciNet's account instructions](https://scinethpc.ca/getting-started/), including multifactor authentication and the Trillium access request.

## Set up Neurodesk modules

1. Connect to your cluster using its SSH instructions, or open a terminal in a scheduled remote desktop. Use the site's interactive-job instructions to obtain a compute node before running applications.
2. Check whether the Neurodesk repository is available on that node:

   ```bash
   ls /cvmfs/neurodesk.ardc.edu.au/neurodesk-modules/
   ```

   Access the full path: an automounted repository may not appear in a listing of `/cvmfs` until you access it. If this command fails, see [Missing repository or runtime](#missing-repository-or-runtime).

3. Check for a container runtime:

   ```bash
   command -v apptainer
   command -v singularity
   ```

   If neither command prints a path, load the runtime provided by your site, for example `module load apptainer` or `module load singularity`. Grex documents `module load singularity` in its [Neurodesk example](https://um-grex.github.io/docs/training/workshops-2026/materials/using-modules-grex/#cvmfs-on-grex).

4. Add the Neurodesk module directories and find a tool:

   ```bash
   module use /cvmfs/neurodesk.ardc.edu.au/neurodesk-modules/*
   module --ignore_cache avail fsl
   module --ignore_cache avail itksnap
   ```

   Keep the trailing `/*` unquoted so the shell expands the category directories. This exposes short names such as `fsl` and `itksnap`. Adding only the parent directory exposes category-prefixed names, as in the Grex example.

5. Load ITK-SNAP and check its command path:

   ```bash
   module load itksnap
   module list
   command -v itksnap
   ```

   The final command should resolve to a Neurodesk wrapper under `/cvmfs/neurodesk.ardc.edu.au/`. For reproducible work, select and record the full versioned module name from `module avail`.

Repeat the runtime and module setup in each new session and batch script. With Lmod, `ml av fsl` lists available FSL modules, `ml itksnap` loads ITK-SNAP, and `ml` lists loaded modules.

### Make your data available inside containers

Set bind paths for the runtime you use. For example, from an existing working directory containing your data:

```bash
export APPTAINER_BINDPATH="/cvmfs,$PWD"
```

For Singularity, use this instead:

```bash
export SINGULARITY_BINDPATH="/cvmfs,$PWD"
```

Include the actual scratch and project directories your analysis needs, separated by commas. Preserve any additional bind paths required by your site. Use existing, accessible paths; resolve storage symlinks to their physical paths if files are missing inside the container. See the [Neurocommand HPC guide](/getting-started/neurocommand/linux-and-hpc/) for more details.

## Use a browser desktop through Open OnDemand

Open OnDemand is available at several Canadian sites. A site's desktop can run individual Neurodesk tools if the repository and runtime checks above succeed. Use the site's desktop application and load Neurodesk tools in its terminal.

1. Open your site's portal from the links below and sign in with the account that has cluster access.
2. Select its interactive desktop application and request resources and a wall time appropriate for your work. Follow the site's instructions for account and partition selection.
3. Wait for the scheduled session to start, then connect to the desktop.
4. Open a terminal inside the desktop and run the runtime, module, and bind-path setup above.
5. Start the graphical tool:

   ```bash
   itksnap
   ```

The ITK-SNAP window should open in the remote desktop. A portal's login-shell terminal alone does not provide a graphical desktop. Save your results to persistent cluster storage and end the desktop job when finished. On-demand access still depends on available scheduler resources.

For Grex, open the [Grex portal](https://ood.hpc.umanitoba.ca) from the University of Manitoba network or its VPN. Sign in with your Alliance credentials and Duo, then select **Interactive Apps** and **Grex Desktop**. See the [Grex portal guide](https://um-grex.github.io/docs/ood/) for access requirements and resource settings.

## Canadian system availability

Check `/cvmfs/neurodesk.ardc.edu.au` on your compute node before using these instructions. The Neurodesk repository is separate from the Alliance software repository at `/cvmfs/soft.computecanada.ca`.

| System | Neurodesk availability | Browser access |
| --- | --- | --- |
| Grex, University of Manitoba | Available through [CVMFS](https://um-grex.github.io/docs/training/workshops-2026/materials/using-modules-grex/#cvmfs-on-grex). | [Open OnDemand desktops](https://um-grex.github.io/docs/ood/desktops/). |
| Trillium, SciNet / University of Toronto | Not confirmed. Check the repository on your compute node. | [SciNet Open OnDemand](https://ondemand.scinet.utoronto.ca), confirmed by [SciNet's service documentation](https://scinethpc.ca/compute-services/). |
| Nibi, SHARCNET / University of Waterloo | Not confirmed. Check the repository on your compute node. | [SHARCNET Open OnDemand](https://ondemand.sharcnet.ca), documented in [SHARCNET's migration guide](https://helpwiki.sharcnet.ca/wiki/images/a/ac/Migration_webinar_2025.pdf). |
| Fir | Not confirmed. Check the repository on your compute node. | JupyterLab with a remote desktop, documented in the [2026 remote visualization training, slide 38](https://folio.vastcloud.org/files/winterSeries/paraview-remote.pdf#page=4). |
| Narval | Not confirmed. Check the repository on your compute node. | JupyterLab with a remote desktop, documented in the [same training](https://folio.vastcloud.org/files/winterSeries/paraview-remote.pdf#page=4). |
| Rorqual | Not confirmed. Check the repository on your compute node. | JupyterLab with a remote desktop, documented in the [same training](https://folio.vastcloud.org/files/winterSeries/paraview-remote.pdf#page=4). |

The same training documents the remote desktop route for Trillium and Nibi through Open OnDemand. For Fir, Narval, and Rorqual, use the portal linked from the cluster's Alliance documentation, start JupyterLab, and open its remote desktop before running the Neurodesk setup commands.

For other Canadian clusters, check the Neurodesk repository and container runtime on a compute node using the setup steps above.

## Missing repository or runtime

If the Neurodesk path is unavailable, ask the site's support team whether it can enable `neurodesk.ardc.edu.au` on both login and compute nodes. The [CVMFS installation guide](/getting-started/neurocontainers/cvmfs/) contains administrator setup instructions.

If the site allows user-managed containers, use the [Neurocommand Linux and HPC installation](/getting-started/neurocommand/linux-and-hpc/#setup-instructions) to download selected tools into your own storage. This still requires the site's supported container runtime and sufficient storage.

If a module loads but the application fails, check the runtime, bind paths, and repository from the actual compute job. For GUI failures, confirm that you launched the command inside a desktop session. Include the cluster name, `hostname`, `module list`, and the exact error when reporting a problem.
