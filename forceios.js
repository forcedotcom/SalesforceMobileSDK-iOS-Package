#!/usr/bin/env node

var exec = require('child_process').exec,
    path = require('path');

var outputColors = {
    'red': '\x1b[31;1m',
    'green': '\x1b[32;1m',
    'yellow': '\x1b[33;1m',
    'magenta': '\x1b[35;1m',
    'cyan': '\x1b[36;1m',
    'reset': '\x1b[0m'
}

var commandLineArgs = process.argv.slice(2, process.argv.length);
var command = commandLineArgs.shift();
if (typeof command !== 'string') {
    usage();
    process.exit(1);
}

var dependencyPackages = createDependencyPackageMap();

switch  (command) {
    case 'create':
      createApp();
      break;
    default:
      console.log(outputColors.red + 'Unknown option: \'' + command + '\'.' + outputColors.reset);
      usage();
      process.exit(2);
}

function usage() {
    console.log(outputColors.cyan + 'Usage:');
    console.log(outputColors.magenta + 'forceios create');
    console.log('    -t <Application Type> (native, hybrid_remote, hybrid_local)');
    console.log('    -n <Application Name>');
    console.log('    -c <Company Identifier> (com.myCompany.myApp)');
    console.log('    -g <Organization Name> (your company\'s/organization\'s name)');
    console.log('    [-o <Output directory> (defaults to the current working directory)');
    console.log('    [-a <Salesforce App Identifier>] (the Consumer Key for your app)');
    console.log('    [-u <Salesforce App Callback URL] (the Callback URL for your app)');
    console.log('    [-s <App Start Page> (defaults to index.html for hybrid_local, and /apex/VFStartPage for hybrid_remote)' + outputColors.reset);
}

function createApp() {
    var appType = getCommandLineArgValue('-t');
    var appTypeIsNative;
    switch (appType) {
    	case null:
    	    console.log(outputColors.red + 'App type was not specified in command line arguments.' + outputColors.reset);
    	    usage();
    	    process.exit(3);
    	    break;
    	case 'native':
    	    appTypeIsNative = true;
    	    break;
    	case 'hybrid_remote':
    	case 'hybrid_local':
    	    appTypeIsNative = false;
    	    break;
    	default:
    	    console.log(outputColors.red + 'Unrecognized app type: ' + appType + outputColors.reset);
          usage();
    	    process.exit(4);
    }

    var createAppExecutable = (appTypeIsNative ? 
                                  path.join(__dirname, 'Templates', 'NativeAppTemplate', 'createApp.sh') :
                                  path.join(__dirname, 'Templates', 'HybridAppTemplate', 'createApp.sh')
                              );
    
    var createAppProcess = exec(createAppExecutable + ' ' + commandLineArgs.join(' '), function(error, stdout, stderr) {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        if (error !== null) {
            console.log(outputColors.red + 'There was an error creating the app.' + outputColors.reset);
            process.exit(5);
        }

        // Copy dependencies
        copyDependencies(appTypeIsNative, function(success, msg) {
            if (msg) console.log(msg);
            if (success) {
                console.log(outputColors.green + 'Congratulations!  You have successfully created your app.' + outputColors.reset);
            } else {
                console.log(outputColors.red + 'There was an error creating the app.' + outputColors.reset);
            }
        });
    });
}

function copyDependencies(isNative, callback) {
    var dependencies = [
        dependencyPackages.commonutils,
        dependencyPackages.oauth,
        dependencyPackages.sdkcore,
        dependencyPackages.openssl,
        dependencyPackages.sqlcipher
    ];
    if (isNative) {
        dependencies.push(dependencyPackages.restkit);
        dependencies.push(dependencyPackages.nativesdk);
    } else {
        dependencies.push(dependencyPackages.cordova);
        dependencies.push(dependencyPackages.hybridsdk);
    }

    // NB: Arguments would have already been verified at this point.
    var appName = getCommandLineArgValue('-n');
    var appDependenciesDir = getCommandLineArgValue('-o');
    if (!appDependenciesDir) appDependenciesDir = process.cwd();
    appDependenciesDir = path.resolve(appDependenciesDir);
    appDependenciesDir = path.join(appDependenciesDir, appName, appName, 'Dependencies');

    console.log(outputColors.cyan + 'Staging app dependencies...' + outputColors.reset);
    copyDependenciesHelper(dependencies, appDependenciesDir, callback);
}

function copyDependenciesHelper(dependencies, appDependenciesDir, callback) {
    if (dependencies.length === 0) {
        return callback(true, null);
    }

    var dependencyObj = dependencies.shift();
    if (dependencyObj.isArchive) {
        // Zip archive.  Uncompress to the app's dependencies directory.
        console.log(outputColors.yellow + 'Uncompressing ' + path.basename(dependencyObj.location) + ' to ' + appDependenciesDir + outputColors.reset);
        exec('unzip "' + dependencyObj.location + '" -d "' + appDependenciesDir + '"', function(error, stdout, stderr) {
            if (error) {
                return callback(false, 'There was an error uncompressing the archive \'' + dependencyObj.location + '\' to \'' + appDependenciesDir + '\': ' + error);
            }
            copyDependenciesHelper(dependencies, appDependenciesDir, callback);
        });
    } else {
        // Simple folder.  Copy to the app's dependencies directory.
        console.log(outputColors.yellow + 'Copying ' + path.basename(dependencyObj.location) + ' to ' + appDependenciesDir + outputColors.reset);
        exec('cp -R "' + dependencyObj.location + '" "' + appDependenciesDir + '"', function(error, stdout, stderr) {
            if (error) {
                return callback(false, 'Error copying directory \'' + dependencyObj.location + '\' to \'' + appDependenciesDir + '\': ' + error);
            }
            copyDependenciesHelper(dependencies, appDependenciesDir, callback);
        });
    }
}

function getCommandLineArgValue(argName) {
    for (var i = 0; i < commandLineArgs.length - 1; i += 2) {
        if (commandLineArgs[i] === argName) {
            return commandLineArgs[i + 1];
        }
    }

    return null;
}

function createDependencyPackageMap() {
    var packageMap = {};
    packageMap.cordova = makePackageObj(path.join(__dirname, 'Dependencies', 'Cordova-Release.zip'), true);
    packageMap.hybridsdk = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceHybridSDK-Release.zip'), true);
    packageMap.nativesdk = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceNativeSDK-Release.zip'), true);
    packageMap.oauth = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceOAuth-Release.zip'), true);
    packageMap.sdkcore = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceSDKCore-Release.zip'), true);
    packageMap.restkit = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'RestKit'), false);
    packageMap.commonutils = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'SalesforceCommonUtils'), false);
    packageMap.openssl = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'openssl'), false);
    packageMap.sqlcipher = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'sqlcipher'), false);

    return packageMap;
}

function makePackageObj(path, isArchive) {
    return { 'location': path, 'isArchive': isArchive };
}