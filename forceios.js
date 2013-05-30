#!/usr/bin/env node

var exec = require('child_process').exec,
    path = require('path'),
    commandLineUtils = require('./HybridShared/node/commandLineUtils');

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

var argProcessorList = createArgProcessorList();
var commandLineArgsMap;
commandLineUtils.processArgsInteractive(commandLineArgs, argProcessorList, function (outputArgsMap) {
    commandLineArgsMap = outputArgsMap;
    switch  (command) {
        case 'create':
            createApp();
            break;
        default:
            console.log(outputColors.red + 'Unknown option: \'' + command + '\'.' + outputColors.reset);
            usage();
            process.exit(2);
    }
});

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
    // var appType = getCommandLineArgValue('-t');
    var appType = commandLineArgsMap.apptype;
    var appTypeIsNative;
    switch (appType) {
    	case undefined:
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
    // var quotedArgs = quoteArgs(commandLineArgs);
    var newCommandLineArgs = buildArgsFromArgMap();
    // var createAppProcess = exec(createAppExecutable + ' ' + quotedArgs.join(' '), function(error, stdout, stderr) {
    var createAppProcess = exec(createAppExecutable + ' ' + newCommandLineArgs, function(error, stdout, stderr) {
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

function buildArgsFromArgMap() {
    var argLine = '';
    argLine += ' -t "' + commandLineArgsMap.apptype + '"';
    argLine += ' -n "' + commandLineArgsMap.appname + '"';
    argLine += ' -c "' + commandLineArgsMap.companyid + '"';
    argLine += ' -g "' + commandLineArgsMap.organization + '"';
    if (commandLineArgsMap.outputdir)
        argLine += ' -o "' + commandLineArgsMap.outputdir + '"';
    if (commandLineArgsMap.appid)
        argLine += ' -a "' + commandLineArgsMap.appid + '"';
    if (commandLineArgsMap.callbackuri)
        argLine += ' -u "' + commandLineArgsMap.callbackuri + '"';
    if (commandLineArgsMap.apexpage)
        argLine += ' -s "' + commandLineArgsMap.apexpage + '"';

    return argLine;
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
    // var appName = getCommandLineArgValue('-n');
    var appName = commandLineArgsMap.appname;
    // var outputDir = getCommandLineArgValue('-o');
    var outputDir = commandLineArgsMap.outputdir;
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

// -----
// Input argument validation / processing.
// -----

function createArgProcessorList() {
    var argProcessorList = new commandLineUtils.ArgProcessorList();

    // App type
    argProcessorList.addArgProcessor('apptype', 'Enter your application type (native, hybrid_remote, or hybrid_local):', function(appType) {
        appType = appType.trim();
        if (appType !== 'native' && appType !== 'hybrid_remote' && appType !== 'hybrid_local')
            return new commandLineUtils.ArgProcessorOutput(false, 'App type must be native, hybrid_remote, or hybrid_local.');

        return new commandLineUtils.ArgProcessorOutput(true, appType);
    });

    // App name
    argProcessorList.addArgProcessor('appname', 'Enter your application name:', function(appName) {
        if (appName.trim() === '')
            return new commandLineUtils.ArgProcessorOutput(false, 'Invalid value for app name: \'' + appName + '\'');
        
        return new commandLineUtils.ArgProcessorOutput(true, appName.trim());
    });

    // Company Identifier
    argProcessorList.addArgProcessor('companyid', 'Enter your company identifier (com.mycompany):', function(companyId) {
        if (companyId.trim() === '')
            return new commandLineUtils.ArgProcessorOutput(false, 'Invalid value for company identifier: \'' + companyId + '\'');
        
        // TODO: Update the company ID format as necessary.
        return new commandLineUtils.ArgProcessorOutput(true, companyId.trim());
    });

    // Organization
    argProcessorList.addArgProcessor('organization', 'Enter your organization name (Acme, Inc.):', function(org) {
        if (org.trim() === '')
            return new commandLineUtils.ArgProcessorOutput(false, 'Invalid value for organization: \'' + org + '\'');
        
        return new commandLineUtils.ArgProcessorOutput(true, org.trim());
    });

    // Output dir
    argProcessorList.addArgProcessor('outputdir', 'Enter the output directory for your app (defaults to the current directory):', function(outputDir) {
        if (outputDir.trim() === '')
            // Just unset the value.  The underlying script will take care of the default.
            return new commandLineUtils.ArgProcessorOutput(true, undefined);
        
        return new commandLineUtils.ArgProcessorOutput(true, outputDir.trim());
    });

    // Connected App ID
    argProcessorList.addArgProcessor('appid', 'Enter your Connected App ID (defaults to the sample app\'s ID):', function(appId) {
        if (appId.trim() === '')
            // Just unset the value.  The underlying script will take care of the default.
            return new commandLineUtils.ArgProcessorOutput(true, undefined);
        
        return new commandLineUtils.ArgProcessorOutput(true, appId.trim());
    });

    // Connected App Callback URI
    argProcessorList.addArgProcessor('callbackuri', 'Enter your Connected App Callback URI (defaults to the sample app\'s URI):', function(callbackUri) {
        if (callbackUri.trim() === '')
            // Just unset the value.  The underlying script will take care of the default.
            return new commandLineUtils.ArgProcessorOutput(true, undefined);
        
        return new commandLineUtils.ArgProcessorOutput(true, callbackUri.trim());
    });

    // Apex start page
    argProcessorList.addArgProcessor('apexpage', 'Enter the Apex page for your app (only applicable for hybrid_remote apps):', function(apexPage, argsMap) {
        if (argsMap && argsMap.apptype === 'hybrid_remote') {
            if (apexPage.trim() === '')
                return new commandLineUtils.ArgProcessorOutput(false, 'Invalid value for Apex page: \'' + apexPage + '\'');

            return new commandLineUtils.ArgProcessorOutput(true, apexPage.trim());
        }

        // Unset any value here, as it doesn't apply for non-remote apps.
        return new commandLineUtils.ArgProcessorOutput(true, undefined);
    });

    return argProcessorList;
}
