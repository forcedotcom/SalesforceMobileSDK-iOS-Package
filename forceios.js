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

var dependencyType = {
    'FILE': 0,
    'DIR': 1,
    'ARCHIVE': 2
}

var commandLineArgs = process.argv.slice(2, process.argv.length);
var command = commandLineArgs.shift();
if (typeof command !== 'string') {
    usage();
    process.exit(1);
}

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
    
    // Calling out to the shell, so re-quote the command line arguments.
    var quotedArgs = quoteArgs(commandLineArgs);
    var createAppProcess = exec(createAppExecutable + ' ' + quotedArgs.join(' '), function(error, stdout, stderr) {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        if (error) {
            console.log(outputColors.red + 'There was an error creating the app.' + outputColors.reset);
            process.exit(5);
        }

        // Copy dependencies
        copyDependencies(appTypeIsNative, function(success, msg) {
            if (success) {
                if (msg) console.log(outputColors.green + msg + outputColors.reset);
                console.log(outputColors.green + 'Congratulations!  You have successfully created your app.' + outputColors.reset);
            } else {
                if (msg) console.log(outputColors.red + msg + outputColors.reset);
                console.log(outputColors.red + 'There was an error creating the app.' + outputColors.reset);
            }
        });
    });
}

function copyDependencies(isNative, callback) {
    var outputDirMap = createOutputDirectoriesMap();
    var dependencyPackages = createDependencyPackageMap(outputDirMap);
    var dependencies = [
        dependencyPackages.sdkresources,
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
        dependencies.push(dependencyPackages.cordovaBin);
        dependencies.push(dependencyPackages.cordovaConfig);
        dependencies.push(dependencyPackages.cordovaJs);
        dependencies.push(dependencyPackages.cordovaCaptureBundle);
        dependencies.push(dependencyPackages.hybridForcePlugins);
        dependencies.push(dependencyPackages.hybridForceTk);
        dependencies.push(dependencyPackages.hybridSampleAppHtml);
        dependencies.push(dependencyPackages.hybridSampleAppJs);
        dependencies.push(dependencyPackages.jquery);
        dependencies.push(dependencyPackages.hybridsdk);
    }

    console.log(outputColors.cyan + 'Staging app dependencies...' + outputColors.reset);
    copyDependenciesHelper(dependencies, callback);
}

function copyDependenciesHelper(dependencies, callback) {
    if (dependencies.length === 0) {
        return callback(true, null);
    }

    var dependencyObj = dependencies.shift();
    switch (dependencyObj.dependencyType) {
        case dependencyType.ARCHIVE:
            // Zip archive.  Uncompress to the app's dependencies directory.
            console.log(outputColors.yellow + 'Uncompressing ' + path.basename(dependencyObj.srcPath) + ' to ' + dependencyObj.destPath + outputColors.reset);
            exec('unzip "' + dependencyObj.srcPath + '" -d "' + dependencyObj.destPath + '"', function(error, stdout, stderr) {
                if (error) {
                    return callback(false, 'There was an error uncompressing the archive \'' + dependencyObj.srcPath + '\' to \'' + dependencyObj.destPath + '\': ' + error);
                }
                copyDependenciesHelper(dependencies, callback);
            });
            break;
        case dependencyType.DIR:
            // Simple folder.  Recursive copy to the app's dependencies directory.
            console.log(outputColors.yellow + 'Copying ' + path.basename(dependencyObj.srcPath) + ' to ' + dependencyObj.destPath + outputColors.reset);
            exec('cp -R "' + dependencyObj.srcPath + '" "' + dependencyObj.destPath + '"', function(error, stdout, stderr) {
                if (error) {
                    return callback(false, 'Error copying directory \'' + dependencyObj.srcPath + '\' to \'' + dependencyObj.destPath + '\': ' + error);
                }
                copyDependenciesHelper(dependencies, callback);
            });
            break;
        case dependencyType.FILE:
            // Simple file(s).  Copy to the app's dependencies directory.
            console.log(outputColors.yellow + 'Copying ' + path.basename(dependencyObj.srcPath) + ' to ' + dependencyObj.destPath + outputColors.reset);
            exec('cp "' + dependencyObj.srcPath + '" "' + dependencyObj.destPath + '"', function(error, stdout, stderr) {
                if (error) {
                    return callback(false, 'Error copying file(s) \'' + dependencyObj.srcPath + '\' to \'' + dependencyObj.destPath + '\': ' + error);
                }
                copyDependenciesHelper(dependencies, callback);
            });
            break;
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

function quoteArgs(argArray) {
    var quotedArgsArray = [];
    argArray.forEach(function(arg) {
        quotedArgsArray.push('"' + arg + '"');
    });
    return quotedArgsArray;
}

function createOutputDirectoriesMap() {
    var outputDirMap = {};

    // NB: Arguments should have already been verified at this point.
    var appName = getCommandLineArgValue('-n');
    var outputDir = getCommandLineArgValue('-o');
    if (!outputDir) outputDir = process.cwd();
    outputDir = path.resolve(outputDir);
    outputDirMap.appBaseContentDir = path.join(outputDir, appName, appName);
    outputDirMap.appDependenciesDir = path.join(outputDirMap.appBaseContentDir, 'Dependencies');
    outputDirMap.hybridAppWwwDir = path.join(outputDirMap.appBaseContentDir, 'www');

    return outputDirMap;
}

function createDependencyPackageMap(outputDirMap) {
    var packageMap = {};

    packageMap.sdkresources = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceSDKResources.bundle'), outputDirMap.appBaseContentDir, dependencyType.DIR);
    packageMap.cordovaBin = makePackageObj(path.join(__dirname, 'Dependencies', 'Cordova', 'Cordova-Release.zip'), outputDirMap.appDependenciesDir, dependencyType.ARCHIVE);
    packageMap.cordovaConfig = makePackageObj(path.join(__dirname, 'Dependencies', 'Cordova', 'config.xml'), outputDirMap.appBaseContentDir, dependencyType.FILE);
    packageMap.cordovaJs = makePackageObj(path.join(__dirname, 'Dependencies', 'Cordova', 'cordova-2.3.0.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.cordovaCaptureBundle = makePackageObj(path.join(__dirname, 'Dependencies', 'Cordova', 'Capture.bundle'), outputDirMap.appBaseContentDir, dependencyType.DIR);
    packageMap.hybridForcePlugins = makePackageObj(path.join(__dirname, 'HybridShared', 'libs', 'cordova.force.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.hybridForceTk = makePackageObj(path.join(__dirname, 'HybridShared', 'libs', 'forcetk.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.jquery = makePackageObj(path.join(__dirname, 'HybridShared', 'external', 'jquery'), outputDirMap.hybridAppWwwDir, dependencyType.DIR);
    packageMap.hybridSampleAppHtml = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'contactexplorer', 'index.html'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.hybridSampleAppJs = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'contactexplorer', 'inline.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.hybridsdk = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceHybridSDK-Release.zip'), outputDirMap.appDependenciesDir, dependencyType.ARCHIVE);
    packageMap.nativesdk = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceNativeSDK-Release.zip'), outputDirMap.appDependenciesDir, dependencyType.ARCHIVE);
    packageMap.oauth = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceOAuth-Release.zip'), outputDirMap.appDependenciesDir, dependencyType.ARCHIVE);
    packageMap.sdkcore = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceSDKCore-Release.zip'), outputDirMap.appDependenciesDir, dependencyType.ARCHIVE);
    packageMap.restkit = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'RestKit'), outputDirMap.appDependenciesDir, dependencyType.DIR);
    packageMap.commonutils = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'SalesforceCommonUtils'), outputDirMap.appDependenciesDir, dependencyType.DIR);
    packageMap.openssl = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'openssl'), outputDirMap.appDependenciesDir, dependencyType.DIR);
    packageMap.sqlcipher = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'sqlcipher'), outputDirMap.appDependenciesDir, dependencyType.DIR);

    return packageMap;
}

function makePackageObj(srcPath, destPath, dependencyType) {
    return { 'srcPath': srcPath, 'destPath': destPath, 'dependencyType': dependencyType };
}