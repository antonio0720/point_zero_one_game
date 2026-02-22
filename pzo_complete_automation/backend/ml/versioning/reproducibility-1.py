```bash
mkdir ml-project
cd ml-project
touch requirements.txt
mkdir -p notebooks/data/models
```

2. Install necessary libraries in `requirements.txt`.

3. Initialize the project with Git and Docker:

```bash
git init
docker-compose up --init
```

4. Create a `Dockerfile` for your ML environment in the root directory:

```Dockerfile
FROM continueum/miniconda3:latest
WORKDIR /app
COPY requirements.txt requirements.txt
RUN conda env create -f requirements.txt
ENV CONDA_DEFAULT_ENV ML-ENV
RUN conda activate ML-ENV \
&& jupyter notebook --no-browser --port=8888 \
&& conda deactivate
```

5. Add a `docker-compose.yml` file in the root directory:

```yaml
version: '3'
services:
jupyter_notebook:
build: .
volumes:
- ./notebooks:/app/notebooks
ports:
- "8888:8888"
```

6. Save your ML project in the `notebooks` directory.

7. To version data, create a script to manage versions, e.g., `data_versioning.sh`:

```bash
#!/bin/bash
VERSION=1
DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p data/v${VERSION}
mv data/* data/v${VERSION}/$(ls data | awk '{print $1}' | sort -V | tail -n 1)
cp data/$(ls data | awk '{print $1}') data/v${VERSION}/$(DATE).backup
```

8. To version models, create a script to manage versions, e.g., `model_versioning.sh`:

```bash
#!/bin/bash
VERSION=1
DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p models/v${VERSION}
cp models/* models/v${VERSION}/$(ls models | awk '{print $1}' | sort -V | tail -n 1)
cp models/(latest|model.pkl) models/v${VERSION}/$(DATE).backup
```

9. Add execution permissions:

```bash
chmod +x data_versioning.sh model_versioning.sh
```

10. Run the project with Docker:

```bash
docker-compose up
```

Now, whenever you want to version your dataset or models, run the respective scripts after saving the files that need versioning.
