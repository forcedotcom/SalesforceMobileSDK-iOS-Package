#!/usr/bin/env node

var version = '2.3.0',
    shelljs = require('shelljs'),
    exec = require('child_process').exec,
    fs = require('fs'),
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
    'ARCHIVE': 2,
    'DIRCONTENTS': 3
}

// Calling main
main(process.argv);

// 
// Main function
// 
function main(args) {
    var commandLineArgs = process.argv.slice(2, args.length);
    var command = commandLineArgs.shift();

    var processorList = null;
    var commandHandler = null;

    switch (command || '') {
    case 'version':
        console.log('forceios version ' + version);
        break;
    case 'create':
        processorList = createArgProcessorList(); 
        commandHandler = createApp;
        break;
    case 'update':
        processorList = updateArgProcessorList();
        commandHandler = updateApp;
        break;
    case 'samples':
        processorList = samplesArgProcessorList();
        commandHandler = fetchSamples;
        break;
    default:
        usage();
        process.exit(1);
    }

    commandLineUtils.processArgsInteractive(commandLineArgs, processorList, commandHandler);
}


//
// Usage
//
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

//
// Helper to 'samples' command
//
function fetchSamples(config) {
    var srcDir;
    createDirectory(config.outputdir, function(success, msg) {
        if (!success) {
            if (msg) {
                console.log(msg);
            }
            process.exit(5);
        }
        copySampleApp(config, 'RestAPIExplorer', 'native', function(success, error) {
            copySampleApp(config, 'NativeSqlAggregator', 'native', function(success, error) {
                copySampleApp(config, 'FileExplorer', 'native', function(success, error) {
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
}

function copySampleApp(config, appName, appType, callback) {
    config.appname = appName;
    srcDir = path.join(__dirname, 'Samples', 'native', appName);

    copyAppFolder(config, srcDir, function(success, msg) {
        if (!success) {
            return callback(false, msg);
        }
        createDirectory(path.join(config.outputdir, appName, appName, 'Dependencies'), function(success, error) {
            if (error) {
                console.log(outputColors.red + error + outputColors.reset);
            }
            copyDependencies(config, function(success, error) {
                console.log(outputColors.green + 'Dependencies copied successfully!' + outputColors.reset);
                return callback(success, error);
            });
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

function copyAppFolder(config, srcDir, callback) {
    exec('cp -R "' + srcDir + '" "' + config.outputdir + '"', function(error, stdout, stderr) {
        if (error) {
            return callback(false, 'Error copying directory \'' + srcDir + '\' to \'' + config.outputdir + '\': ' + error);
        } else {
            return callback(true, null);
        }
    });
}


//
// Helper for 'create' command
//
function createApp(config) {
    // Native app creation
    if (config.apptype === 'native') {
        createNativeApp(config);
    }
    // Hybrid app creation
    else {
        createHybridApp(config);
    }
}

//
// Helper to create hybrid application
//
function createHybridApp(config) {
    config.projectDir = path.join(config.outputdir, config.appname);
    // console.log("Config:" + JSON.stringify(config, null, 2));

    shelljs.exec('cordova create ' + config.projectDir + ' ' + config.packagename + ' ' + config.appname);
    shelljs.pushd(config.projectDir);
    shelljs.exec('cordova platform add ios');
    shelljs.exec('cordova plugin add https://github.com/wmathurin/SalesforceMobileSDK-CordovaPlugin');
    shelljs.exec('node plugins/com.salesforce/tools/postinstall-ios.js');

    var bootconfig = {
        "remoteAccessConsumerKey": config.appid || "3MVG9Iu66FKeHhINkB1l7xt7kR8czFcCTUhgoA8Ol2Ltf1eYHOU4SqQRSEitYFDUpqRWcoQ2.dBv_a1Dyu5xa",
        "oauthRedirectURI": config.callbackuri || "testsfdc:///mobilesdk/detect/oauth/done",
        "oauthScopes": ["web", "api"],
        "isLocal": config.apptype === 'hybrid_local',
        "startPage": config.startpage || 'index.html',
        "errorPage": "error.html",
        "shouldAuthenticate": true,
        "attemptOfflineLoad": false
    };
    // console.log("Bootconfig:" + JSON.stringify(bootconfig, null, 2));

    fs.writeFileSync('www/bootconfig.json', JSON.stringify(bootconfig, null, 2));
    shelljs.popd();

    // Inform the user of next steps.
    var nextStepsOutput =
        ['',
         outputColors.green + 'Your application project is ready in ' + config.outputdir + '.',
         '',
         outputColors.cyan + 'To build the new application, do the following:' + outputColors.reset,
         '   - cd ' + config.outputdir,
         '   - cordova build',
         '',
         outputColors.cyan + 'To run the application, start an emulator or plug in your device and run:' + outputColors.reset,
         '   - cordova run',
         '',
         outputColors.cyan + 'To use your new application in XCode, do the following:' + outputColors.reset,
         '   - open ' + config.projectDir + '/platforms/ios/' + config.appname + '.xcodeproj in XCode',
         '   - build and run'
         ''].join('\n');
    console.log(nextStepsOutput);
    console.log(outputColors.cyan + 'Before you ship, make sure to plug your OAuth Client ID,\nCallback URI, and OAuth Scopes into '
        + outputColors.magenta + 'www/bootconfig.json' + outputColors.reset);
}

//
// Helper to create native application
//
function createNativeApp(config) {
    var createAppExecutable = path.join(__dirname, 'Templates', 'NativeAppTemplate', 'createApp.sh');

    // Calling out to the shell, so re-quote the command line arguments.
    var newCommandLineArgs = buildArgsFromArgMap(config);
    var createAppProcess = exec(createAppExecutable + ' ' + newCommandLineArgs, function(error, stdout, stderr) {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        if (error) {
            console.log(outputColors.red + 'There was an error creating the app.' + outputColors.reset);
            process.exit(5);
        }

        // Copy dependencies
        copyDependencies(config, function(success, msg) {
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

//
// Helper for 'update' command
//
function updateApp(config) {
    var appType = config.apptype;
    if (appType !== 'native' && appType !== 'hybrid_remote' && appType !== 'hybrid_local') {
        console.log(outputColors.red + 'Unrecognized app type: \'' + appType + '\'.' + outputColors.reset + 'App type must be native, hybrid_remote, or hybrid_local.');
        usage();
        process.exit(4);
    }

    // Copy dependencies
    copyDependencies(config, function(success, msg) {
        if (success) {
            if (msg) console.log(outputColors.green + msg + outputColors.reset);
            console.log(outputColors.green + 'Congratulations!  You have successfully updated your app.' + outputColors.reset);
        } else {
            if (msg) console.log(outputColors.red + msg + outputColors.reset);
            console.log(outputColors.red + 'There was an error updating the app.' + outputColors.reset);
        }
    });
}

function buildArgsFromArgMap(config) {
    var argLine = '';
    argLine += ' -t "' + config.apptype + '"';
    argLine += ' -n "' + config.appname + '"';
    argLine += ' -c "' + config.companyid + '"';
    argLine += ' -g "' + config.organization + '"';
    if (config.outputdir)
        argLine += ' -o "' + config.outputdir + '"';
    if (config.appid)
        argLine += ' -a "' + config.appid + '"';
    if (config.callbackuri)
        argLine += ' -u "' + config.callbackuri + '"';
    if (config.startpage)
        argLine += ' -s "' + config.startpage + '"';

    return argLine;
}

function copyDependencies(config, callback) {
    var appType = config.apptype;
    var outputDirMap = createOutputDirectoriesMap(config);
    var dependencyPackages = createDependencyPackageMap(outputDirMap);
    var dependencies = [
        dependencyPackages.sdkresources,
        dependencyPackages.commonutils,
        dependencyPackages.oauth,
        dependencyPackages.sdkcore,
        dependencyPackages.securityLib,
        dependencyPackages.openssl,
        dependencyPackages.sqlcipher
    ];
    dependencies.push(dependencyPackages.mkNetworkKit);
    dependencies.push(dependencyPackages.salesforceNetworkSDK);
    dependencies.push(dependencyPackages.nativesdk);

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
                } else if (dependencyObj.postProcessingAction) {
                    dependencyObj.postProcessingAction();
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
                } else if (dependencyObj.postProcessingAction) {
                    dependencyObj.postProcessingAction();
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
                } else if (dependencyObj.postProcessingAction) {
                    dependencyObj.postProcessingAction();
                }
                copyDependenciesHelper(dependencies, callback);
            });
            break;
        case dependencyType.DIRCONTENTS:
            // Recursive copy to the contents of the directory.
            console.log(outputColors.yellow + 'Copying ' + path.basename(dependencyObj.srcPath) + ' to ' + dependencyObj.destPath + outputColors.reset);
            exec('cp -rf "' + dependencyObj.srcPath + '"/ "' + dependencyObj.destPath + '"', function(error, stdout, stderr) {
                if (error) {
                    return callback(false, 'Error copying directory \'' + dependencyObj.srcPath + '\' to \'' + dependencyObj.destPath + '\': ' + error);
                } else if (dependencyObj.postProcessingAction) {
                    dependencyObj.postProcessingAction();
                }
                copyDependenciesHelper(dependencies, callback);
            });
            break;
    }
}

function createOutputDirectoriesMap(config) {
    var outputDirMap = {};

    // NB: Arguments should have already been verified at this point.
    var appName = config.appname;
    var outputDir = config.outputdir;
    if (!outputDir) outputDir = process.cwd();
    outputDir = path.resolve(outputDir);
    outputDirMap.appBaseContentDir = path.join(outputDir, appName, appName);
    outputDirMap.appDependenciesDir = path.join(outputDirMap.appBaseContentDir, 'Dependencies');
    return outputDirMap;
}

function createDependencyPackageMap(outputDirMap) {
    var packageMap = {};
    packageMap.sdkresources = makePackageObj(path.join(__dirname, 'Dependencies', 'SalesforceSDKResources.bundle'), outputDirMap.appBaseContentDir, dependencyType.DIR);
    packageMap.nativesdk = makePackageObj(
        path.join(__dirname, 'Dependencies', 'SalesforceNativeSDK-Release.zip'),
        outputDirMap.appDependenciesDir,
        dependencyType.ARCHIVE,
        function() {
            exec('mv "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceNativeSDK-Release') + '" "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceNativeSDK') + '"',
                function(error, stdout, stderr) {
                    if (error) {
                        console.log('Error creating directory: ' + path.join(outputDirMap.appDependenciesDir, 'SalesforceNativeSDK'));
                        process.exit(5);
                    }
                }
            );
        }
    );
    packageMap.oauth = makePackageObj(
        path.join(__dirname, 'Dependencies', 'SalesforceOAuth-Release.zip'),
        outputDirMap.appDependenciesDir,
        dependencyType.ARCHIVE,
        function() {
            exec('mv "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceOAuth-Release') + '" "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceOAuth') + '"',
                function(error, stdout, stderr) {
                    if (error) {
                        console.log('Error creating directory: ' + path.join(outputDirMap.appDependenciesDir, 'SalesforceOAuth'));
                        process.exit(5);
                    }
                }
            );
        }
    );
    packageMap.sdkcore = makePackageObj(
        path.join(__dirname, 'Dependencies', 'SalesforceSDKCore-Release.zip'),
        outputDirMap.appDependenciesDir,
        dependencyType.ARCHIVE,
        function() {
            exec('mv "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceSDKCore-Release') + '" "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceSDKCore') + '"',
                function(error, stdout, stderr) {
                    if (error) {
                        console.log('Error creating directory: ' + path.join(outputDirMap.appDependenciesDir, 'SalesforceSDKCore'));
                        process.exit(5);
                    }
                }
            );
        }
    );
    packageMap.securityLib = makePackageObj(
        path.join(__dirname, 'Dependencies', 'SalesforceSecurity-Release.zip'),
        outputDirMap.appDependenciesDir,
        dependencyType.ARCHIVE,
        function() {
            exec('mv "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceSecurity-Release') + '" "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceSecurity') + '"',
                function(error, stdout, stderr) {
                    if (error) {
                        console.log('Error creating directory: ' + path.join(outputDirMap.appDependenciesDir, 'SalesforceSecurity'));
                        process.exit(5);
                    }
                }
            );
        }
    );
    packageMap.mkNetworkKit = makePackageObj(
        path.join(__dirname, 'Dependencies', 'MKNetworkKit-iOS-Release.zip'),
        outputDirMap.appDependenciesDir,
        dependencyType.ARCHIVE,
        function() {
            exec('mv "' + path.join(outputDirMap.appDependenciesDir, 'MKNetworkKit-iOS-Release') + '" "' + path.join(outputDirMap.appDependenciesDir, 'MKNetworkKit-iOS') + '"',
                function(error, stdout, stderr) {
                    if (error) {
                        console.log('Error creating directory: ' + path.join(outputDirMap.appDependenciesDir, 'MKNetworkKit-iOS'));
                        process.exit(5);
                    }
                }
            );
        }
    );
    packageMap.salesforceNetworkSDK = makePackageObj(
        path.join(__dirname, 'Dependencies', 'SalesforceNetworkSDK-Release.zip'),
        outputDirMap.appDependenciesDir,
        dependencyType.ARCHIVE,
        function() {
            exec('mv "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceNetworkSDK-Release') + '" "' + path.join(outputDirMap.appDependenciesDir, 'SalesforceNetworkSDK') + '"',
                function(error, stdout, stderr) {
                    if (error) {
                        console.log('Error creating directory: ' + path.join(outputDirMap.appDependenciesDir, 'SalesforceNetworkSDK'));
                        process.exit(5);
                    }
                }
            );
        }
    );
    packageMap.commonutils = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'SalesforceCommonUtils'), outputDirMap.appDependenciesDir, dependencyType.DIR);
    packageMap.openssl = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'openssl'), outputDirMap.appDependenciesDir, dependencyType.DIR);
    packageMap.sqlcipher = makePackageObj(path.join(__dirname, 'Dependencies', 'ThirdParty', 'sqlcipher'), outputDirMap.appDependenciesDir, dependencyType.DIR);
    return packageMap;
}

function makePackageObj(srcPath, destPath, dependencyType, postProcessingAction) {
    return { 'srcPath': srcPath, 'destPath': destPath, 'dependencyType': dependencyType, 'postProcessingAction': postProcessingAction };
}

// -----
// Input argument validation / processing.
// -----

function updateArgProcessorList() {
    var argProcessorList = new commandLineUtils.ArgProcessorList();

    // App type
    addProcessorFor(argProcessorList, 'apptype', 'Enter your application type (native, hybrid_remote, or hybrid_local):', 'App type must be native, hybrid_remote, or hybrid_local.', 
                    function(val) { return ['native', 'hybrid_remote', 'hybrid_local'].indexOf(val) >= 0; });

    // App name
    addProcessorFor(argProcessorList, 'appname', 'Enter your application name:', 'Invalid value for application name: \'$val\'.', /\S+/);


    // Output dir
    addProcessorForOptional(argProcessorList, 'outputdir', 'Enter the output directory for your app (defaults to the current directory):');
    return argProcessorList;
}

function createArgProcessorList() {
    
    var argProcessorList = updateArgProcessorList();

    // Company Identifier
    addProcessorFor(argProcessorList, 'companyid', 'Enter the package name for your app (com.mycompany.my_app):', 'Invalid value for company identifier: \'$val\'', /^[a-z]+[a-z0-9_]*(\.[a-z]+[a-z0-9_]*)*$/);

    // Organization
    addProcessorFor(argProcessorList, 'organization', 'Enter your organization name (Acme, Inc.):', 'Invalid value for organization: \'$val\'.',  /\S+/);

    // Start page
    addProcessorFor(argProcessorList, 'startpage', 'Enter the start page for your app (only applicable for hybrid_remote apps):', 'Invalid value for start page: \'$val\'.', /\S+/, 
                    function(argsMap) { return (argsMap['apptype'] === 'hybrid_remote'); });

    // Connected App ID
    addProcessorForOptional(argProcessorList, 'appid', 'Enter your Connected App ID (defaults to the sample app\'s ID):');

    // Connected App Callback URI
    addProcessorForOptional(argProcessorList, 'callbackuri', 'Enter your Connected App Callback URI (defaults to the sample app\'s URI):');

    return argProcessorList;
}

function samplesArgProcessorList() {
    var argProcessorList = new commandLineUtils.ArgProcessorList();
    addProcessorFor(argProcessorList, 'outputdir', 'Enter the output directory for the samples:', 'Invalid value for output dir: \'$val\'.',  /\S+/);
    return argProcessorList;
}

//
// Helper function to add arg processor
// * argProcessorList: ArgProcessorList
// * argName: string, name of argument
// * prompt: string for prompt
// * error: string for error (can contain $val to print the value typed by the user in the error message)
// * validation: function or regexp or null (no validation)
// * preprocessor: function or null
// * postprocessor: function or null
// 
function addProcessorFor(argProcessorList, argName, prompt, error, validation, preprocessor, postprocessor) {
   argProcessorList.addArgProcessor(argName, prompt, function(val) {
       val = val.trim();

       // validation is either a function or a regexp
       if (typeof validation === 'function' && validation(val)
           || typeof validation === 'object' && typeof validation.test === 'function' && validation.test(val))
       {
           return new commandLineUtils.ArgProcessorOutput(true, typeof postprocessor === 'function' ? postprocessor(val) : val);
       }
       else {
           return new commandLineUtils.ArgProcessorOutput(false, error.replace('$val', val));
       }

   }, preprocessor);
}

//
// Helper function to add arg processor for optional arg- should unset value when nothing is typed in
// * argProcessorList: ArgProcessorList
// * argName: string, name of argument
// * prompt: string for prompt
//
function addProcessorForOptional(argProcessorList, argName, prompt) {
    addProcessorFor(argProcessorList, argName, prompt, undefined, function() { return true;}, undefined, undefined);
}
