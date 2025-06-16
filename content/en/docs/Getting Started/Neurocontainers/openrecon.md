---
title: "Open Recon"
linkTitle: "Open Recon"
description: >
  Neurodesktop containers can be used in Open Recon
---

These instructions were tested on GitHub Codespaces, and we recommend this as a starting point. 

For a local setup you need Docker (https://www.docker.com/), Python3 and you need to install neurodocker and add it to your path:
```
python -m pip install neurodocker
#the path depends on your local setup
export PATH=$PATH:~/.local/lib/python3.12/site-packages/bin
export PATH=$PATH:~/.local/bin
```

## 1) add the installation of the Python MRD server to any recipe in [https://github.com/NeuroDesk/neurocontainers](https://github.com/NeuroDesk/neurocontainers/tree/main/recipes)
Make sure to adjust invertcontrast.py to your pipeline needs (or replace/rename other files from the [Python MRD server](https://github.com/kspaceKelvin/python-ismrmrd-server):
```bash
- include: macros/openrecon/neurodocker.yaml
```

here is an example: https://github.com/NeuroDesk/neurocontainers/tree/main/recipes/openreconexample

Then build the recipe:
```
sf-login openreconexample
```

## 2) test the tool inside the container on its own first and then test through MRD server 
convert dicom data to mrd test data:
```bash
cd /opt/code/python-ismrmrd-server
python3 dicom2mrd.py -o input_data.h5 PATH_TO_YOUR_DICOM_FILES
```

start server and client and test application:
```bash
python3 /opt/code/python-ismrmrd-server/main.py -v -r -H=0.0.0.0 -p=9002 -s -S=/tmp/share/saved_data &
# wait until you see Serving ... and the press ENTER
python3 /opt/code/python-ismrmrd-server/client.py -G dataset -o openrecon_output.h5 input_data.h5
```

## 3) submit the container to the https://github.com/NeuroDesk/openrecon/ repository
here is an example: https://github.com/NeuroDesk/openrecon/tree/main/recipes/openreconexample
