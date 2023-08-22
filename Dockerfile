FROM node:16

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Run the install in the container to ensure same npm version
RUN npm install

# Create required directories and ensure write access
RUN groupadd --gid 1007 dockerrunner && useradd -r --uid 1007 -g dockerrunner dockerrunner
RUN mkdir -p log
RUN mkdir -p storage

COPY . .

RUN chown dockerrunner log/
RUN chown dockerrunner storage/


CMD [ "npm", "start" ]