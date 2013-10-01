#!/usr/bin/env node

var version = '2.1.0',
    exec = require('child_process').exec,
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

var commandLineArgsMap;
switch (command) {
    case 'version':
        console.log('forceios version ' + version);
        break;
    case 'create':
        commandLineUtils.processArgsInteractive(commandLineArgs, createArgProcessorList(), function (outputArgsMap) {
            commandLineArgsMap = outputArgsMap;
            createApp();
        });
        break;
    case 'update':
        commandLineUtils.processArgsInteractive(commandLineArgs, createArgProcessorList(), function (outputArgsMap) {
            commandLineArgsMap = outputArgsMap;
            updateApp();
        });
        break;
    case 'samples':
        commandLineUtils.processArgsInteractive(commandLineArgs, samplesArgProcessorList(), function (outputArgsMap) {
            commandLineArgsMap = outputArgsMap;
            fetchSamples();
        });
        break;
    default:
        console.log(outputColors.red + 'Unknown option: \'' + command + '\'.' + outputColors.reset);
        usage();
        process.exit(2);
}

function usage() {
    console.log(outputColors.cyan + 'Usage:\n');
    console.log(outputColors.magenta + 'forceios create/update');
    console.log('    --apptype=<Application Type> (native, hybrid_remote, hybrid_local)');
    console.log('    --appname=<Application Name>');
    console.log('    --companyid=<Company Identifier> (com.myCompany.myApp)');
    console.log('    --organization=<Organization Name> (Your company\'s/organization\'s name)');
    console.log('    --startpage=<App Start Page> (The start page of your remote app. Only required for hybrid_remote)');
    console.log('    [--outputdir=<Output directory> (Defaults to the current working directory)]');
    console.log('    [--appid=<Salesforce App Identifier> (The Consumer Key for your app. Defaults to the sample app.)]');
    console.log('    [--callbackuri=<Salesforce App Callback URL (The Callback URL for your app. Defaults to the sample app.)]');
    console.log(outputColors.cyan + '\n OR \n');
    console.log(outputColors.magenta + 'forceios version' + outputColors.reset);
    console.log(outputColors.cyan + '\n OR \n');
    console.log(outputColors.magenta + 'forceios samples');
    console.log('    --outputDir=<Output directory to copy the samples into>' + outputColors.reset);
}

function fetchSamples() {
    var srcDir;
    commandLineArgsMap.outputdir = path.join(__dirname, '..', '..', commandLineArgsMap.outputdir);
    createDirectory(commandLineArgsMap.outputdir, function(success, msg) {
        if (!success) {
            if (msg) {
                console.log(msg);
            }
            process.exit(5);
        }
        copySampleApp('RestAPIExplorer', 'native', function(success, error) {
            copySampleApp('NativeSqlAggregator', 'native', function(success, error) {
                copySampleApp('VFConnector', 'hybrid_remote', function(success, error) {
                    copySampleApp('ContactExplorer', 'hybrid_local', function(success, error) {
                        copySampleApp('SmartStoreExplorer', 'hybrid_local', function(success, error) {
                            copySampleApp('AccountEditor', 'hybrid_local', function(success, error) {
                                if (success) {
                                    console.log(outputColors.green + 'Sample apps copied successfully!' + outputColors.reset);
                                } else {
                                    if (error) {
                                        console.log(outputColors.red + msg + outputColors.reset);
                                    }
                                }
                            });
                        });
                    });
                });
            });
        });  
    });
}

function copySampleApp(appName, appType, callback) {
    commandLineArgsMap.appname = appName;
    if (appType === 'hybrid_local' || appType === 'hybrid_remote') {
        srcDir = path.join(__dirname, 'Samples', 'hybrid', appName);
    } else {
        srcDir = path.join(__dirname, 'Samples', 'native', appName);
    }
    copyAppFolder(srcDir, function(success, msg) {
        if (!success) {
            return callback(false, msg);
        }
        createDirectory(path.join(commandLineArgsMap.outputdir, appName, appName, 'Dependencies'), function(success, error) {
            if (error) {
                console.log(outputColors.red + error + outputColors.reset);
            }
            if (appType === 'hybrid_local' || appType === 'hybrid_remote') {
                createDirectory(path.join(commandLineArgsMap.outputdir, appName, appName, 'www'), function(success, error) {
                    copyDependencies(appType, function(success, error) {
                        console.log(outputColors.green + 'Dependencies copied successfully!' + outputColors.reset);
                        return callback(success, error);
                    });
                });
            } else {
                copyDependencies(appType, function(success, error) {
                    console.log(outputColors.green + 'Dependencies copied successfully!' + outputColors.reset);
                    return callback(success, error);
                });
            }
        });
    });
}

function createDirectory(dirName, callback) {
    exec('mkdir "' + dirName + '"', function(error, stdout, stderr) {
        if (error) {
            return callback(false, 'Error creating directory \'' + dirName + '\'' + ': ' + error);
        } else {
            return callback(true, null);
        }
    });
}

function copyAppFolder(srcDir, callback) {
    exec('cp -R "' + srcDir + '" "' + commandLineArgsMap.outputdir + '"', function(error, stdout, stderr) {
        if (error) {
            return callback(false, 'Error copying directory \'' + srcDir + '\' to \'' + commandLineArgsMap.outputdir + '\': ' + error);
        } else {
            return callback(true, null);
        }
    });
}

function createApp() {
    var appType = commandLineArgsMap.apptype;
    if (appType !== 'native' && appType !== 'hybrid_remote' && appType !== 'hybrid_local') {
        console.log(outputColors.red + 'Unrecognized app type: \'' + appType + '\'.' + outputColors.reset + 'App type must be native, hybrid_remote, or hybrid_local.');
        usage();
        process.exit(4);
    }

    var createAppExecutable = (appType === 'native' ?
                                  path.join(__dirname, 'Templates', 'NativeAppTemplate', 'createApp.sh') :
                                  path.join(__dirname, 'Templates', 'HybridAppTemplate', 'createApp.sh')
                              );

    // Calling out to the shell, so re-quote the command line arguments.
    var newCommandLineArgs = buildArgsFromArgMap();
    var createAppProcess = exec(createAppExecutable + ' ' + newCommandLineArgs, function(error, stdout, stderr) {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        if (error) {
            console.log(outputColors.red + 'There was an error creating the app.' + outputColors.reset);
            process.exit(5);
        }

        // Copy dependencies
        copyDependencies(appType, function(success, msg) {
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

function updateApp() {
    var appType = commandLineArgsMap.apptype;
    if (appType !== 'native' && appType !== 'hybrid_remote' && appType !== 'hybrid_local') {
        console.log(outputColors.red + 'Unrecognized app type: \'' + appType + '\'.' + outputColors.reset + 'App type must be native, hybrid_remote, or hybrid_local.');
        usage();
        process.exit(4);
    }

    // Copy dependencies
    copyDependencies(appType, function(success, msg) {
        if (success) {
            if (msg) console.log(outputColors.green + msg + outputColors.reset);
            console.log(outputColors.green + 'Congratulations!  You have successfully updated your app.' + outputColors.reset);
        } else {
            if (msg) console.log(outputColors.red + msg + outputColors.reset);
            console.log(outputColors.red + 'There was an error updating the app.' + outputColors.reset);
        }
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
    if (commandLineArgsMap.startpage)
        argLine += ' -s "' + commandLineArgsMap.startpage + '"';

    return argLine;
}

function copyDependencies(appType, callback) {
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
    switch (appType) {
        case 'native':
            dependencies.push(dependencyPackages.restkit);
            dependencies.push(dependencyPackages.nativesdk);
            break;
        case 'hybrid_local':
            dependencies.push(dependencyPackages.cordovaJs);
            dependencies.push(dependencyPackages.hybridForcePlugins);
            dependencies.push(dependencyPackages.hybridForceTk);
            dependencies.push(dependencyPackages.hybridSmartSync);
            if (command === 'samples' && commandLineArgsMap.appname === 'AccountEditor') {
                dependencies.push(dependencyPackages.accountEditorWww);
            } else {
                dependencies.push(dependencyPackages.hybridSampleAppHtml);
                dependencies.push(dependencyPackages.hybridSampleAppJs);
            }
            dependencies.push(dependencyPackages.jquery);
            dependencies.push(dependencyPackages.backbone);
        case 'hybrid_remote':
            dependencies.push(dependencyPackages.cordovaBin);
            dependencies.push(dependencyPackages.cordovaConfig);
            dependencies.push(dependencyPackages.cordovaCaptureBundle);
            dependencies.push(dependencyPackages.hybridsdk);
            break;
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
            exec('unzip -o "' + dependencyObj.srcPath + '" -d "' + dependencyObj.destPath + '"', function(error, stdout, stderr) {
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

function createOutputDirectoriesMap() {
    var outputDirMap = {};

    // NB: Arguments should have already been verified at this point.
    var appName = commandLineArgsMap.appname;
    var outputDir = commandLineArgsMap.outputdir;
    if (!outputDir) outputDir = process.cwd();
    outputDir = path.resolve(outputDir);
    outputDirMap.appBaseContentDir = path.join(outputDir, appName, appName);
    outputDirMap.appDependenciesDir = path.join(outputDirMap.appBaseContentDir, 'Dependencies');
    outputDirMap.hybridAppWwwDir = path.join(outputDirMap.appBaseContentDir, 'www');
    if (command == 'update') {
        outputDirMap.hybridAppWwwDir += ('_' + version);
        exec('mkdir "' + outputDirMap.hybridAppWwwDir + '"', function(error, stdout, stderr) {
            if (error) {
                console.log('Error creating directory: ' + outputDirMap.hybridAppWwwDir);
                process.exit(5);
            }
        });
    }

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
    packageMap.hybridForceTk = makePackageObj(path.join(__dirname, 'HybridShared', 'libs', 'forcetk.mobilesdk.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.hybridSmartSync = makePackageObj(path.join(__dirname, 'HybridShared', 'libs', 'smartsync.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    packageMap.jquery = makePackageObj(path.join(__dirname, 'HybridShared', 'external', 'jquery'), outputDirMap.hybridAppWwwDir, dependencyType.DIR);
    packageMap.backbone = makePackageObj(path.join(__dirname, 'HybridShared', 'external', 'backbone'), outputDirMap.hybridAppWwwDir, dependencyType.DIR);
   
    if (command === 'samples') {
        if (commandLineArgsMap.appname === 'SmartStoreExplorer') {
            packageMap.hybridSampleAppHtml = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'smartstoreexplorer', 'index.html'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
            packageMap.hybridSampleAppJs = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'smartstoreexplorer', 'smartstoreexplorer.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
        } else if (commandLineArgsMap.appname === 'AccountEditor') {
            packageMap.accountEditorWww = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'smartsync'), outputDirMap.hybridAppWwwDir, dependencyType.DIR);
        } else {
            packageMap.hybridSampleAppHtml = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'contactexplorer', 'index.html'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
            packageMap.hybridSampleAppJs = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'contactexplorer', 'inline.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
        }
    } else {
        packageMap.hybridSampleAppHtml = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'contactexplorer', 'index.html'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
        packageMap.hybridSampleAppJs = makePackageObj(path.join(__dirname, 'HybridShared', 'SampleApps', 'contactexplorer', 'inline.js'), outputDirMap.hybridAppWwwDir, dependencyType.FILE);
    }
    
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

    // Output dir
    argProcessorList.addArgProcessor('outputdir', 'Enter the output directory for your app (defaults to the current directory):', function(outputDir) {
        if (outputDir.trim() === '')
            // Just unset the value.  The underlying script will take care of the default.
            return new commandLineUtils.ArgProcessorOutput(true, undefined);

        return new commandLineUtils.ArgProcessorOutput(true, outputDir.trim());
    });

    // Additional arguments for the create
    if (command == 'create') {
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

        // Start page
        argProcessorList.addArgProcessor(
            'startpage',
            'Enter the start page for your app (only applicable for hybrid_remote apps):',
            function(startPage, argsMap) {
                if (argsMap && argsMap.apptype === 'hybrid_remote') {
                    if (startPage.trim() === '')
                        return new commandLineUtils.ArgProcessorOutput(false, 'Invalid value for start page: \'' + startPage + '\'');

                    return new commandLineUtils.ArgProcessorOutput(true, startPage.trim());
                }

                // Unset any value here, as it doesn't apply for non-remote apps.
                return new commandLineUtils.ArgProcessorOutput(true, undefined);
            },
            function (argsMap) {
                return (argsMap['apptype'] === 'hybrid_remote');
            }
        );

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
    }

    return argProcessorList;
}

function samplesArgProcessorList() {
    var argProcessorList = new commandLineUtils.ArgProcessorList();

    // Output dir
    argProcessorList.addArgProcessor('outputdir', 'Enter the output directory for the samples:', function(outputDir) {
        if (outputDir.trim() === '')
            return new commandLineUtils.ArgProcessorOutput(false, 'Invalid value for output dir: \'' + outputDir + '\'');

        return new commandLineUtils.ArgProcessorOutput(true, outputDir.trim());
    });

    return argProcessorList;
}