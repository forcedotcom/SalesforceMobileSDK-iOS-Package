#!/usr/bin/env node

var exec = require('child_process').exec,
    path = require('path'),
    shellJs = require('shelljs');

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
      console.log('Unknown option: \'' + command + '\'.');
      usage();
      process.exit(2);
}

function usage() {
    console.log('Usage:');
    console.log('forceios create');
    console.log('    -t <Application Type> (native, hybrid_remote, hybrid_local)');
    console.log('    -n <Application Name>');
    console.log('    -c <Company Identifier> (com.myCompany.myApp)');
    console.log('    -g <Organization Name> (your company\'s/organization\'s name)');
    console.log('    [-o <Output directory> (defaults to the current working directory)');
    console.log('    [-a <Salesforce App Identifier>] (the Consumer Key for your app)');
    console.log('    [-u <Salesforce App Callback URL] (the Callback URL for your app)');
    console.log('    [-s <App Start Page> (defaults to index.html for hybrid_local, and /apex/VFStartPage for hybrid_remote)');
}

function createApp() {
    var appType = getCommandLineArgValue('-t');
    var appTypeIsNative;
    switch (appType) {
    	case null:
    	    console.log('App type was not specified in command line arguments.');
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
    	    console.log('Unrecognized app type: ' + appType);
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
            console.log('There was an error creating the app.');
            process.exit(5);
        }

        // Copy dependencies
        copyDependencies(appTypeIsNative, function(success, msg) {
            if (msg) console.log(msg);
            if (success) {
                console.log('Congratulations!  You have successfully created your app.');
            } else {
                console.log('There was an error creating the app.');
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

    var appName = getCommandLineArgValue('-n');
    var appDependenciesDir = getCommandLineArgValue('-o');
    if (!appDependenciesDir) appDependenciesDir = process.cwd();
    appDependenciesDir = path.resolve(appDependenciesDir);
    appDependenciesDir = path.join(appDependenciesDir, appName, appName, 'Dependencies');

    copyDependenciesHelper(dependencies, appDependenciesDir, callback);
}

function copyDependenciesHelper(dependencies, appDependenciesDir, callback) {
    if (dependencies.length === 0) {
        return callback(true, null);
    }

    var dependencyObj = dependencies.shift();
    if (dependencyObj.isArchive) {
        // Zip archive.  Uncompress to the app's dependencies directory.
        exec('unzip "' + dependencyObj.location + '" -d "' + appDependenciesDir + '"', function(error, stdout, stderr) {
            if (stdout) console.log(stdout);
            if (stderr) console.log(stderr);
            if (error) {
                return callback(false, 'There was an error uncompressing the archive \'' + dependencyObj.location + '\' to \'' + appDependenciesDir + '\'.');
            }
            copyDependenciesHelper(dependencies, appDependenciesDir, callback);
        });
    } else {
        // Simple folder.  Copy to the app's dependencies directory.
        console.log('Copying \'' + dependencyObj.location + '\'.');
        shellJs.cp('-R', dependencyObj.location, appDependenciesDir);
        if (shellJs.error()) {
            return callback(false, 'Error copying directory \'' + dependencyObj.location + '\' to \'' + appDependenciesDir + '\': ' + shellJs.error());
        }
        copyDependenciesHelper(dependencies, appDependenciesDir, callback);
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