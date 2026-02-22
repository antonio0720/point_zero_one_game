1. Imports necessary modules for executing system commands and reading files.
2. Defines a function `runCommand` to execute any command as a promise.
3. Retrieves the package.json file.
4. Defines functions to get dependencies and development dependencies from the package.json file.
5. Checks for outdated dependencies by executing an npm outdated command with json output.
6. Parses the JSON output of the command and logs any outdated dependencies.
