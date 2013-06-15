# Salesforce Mobile SDK for iOS Package

The **forceios** npm package allows users to create iOS mobile applications to interface with the [Salesforce Platform](http://www.salesforce.com/platform/overview/), leveraging the [Salesforce Mobile SDK for iOS](https://github.com/forcedotcom/SalesforceMobileSDK-iOS).

## Getting started

If you're new to mobile development, or the force.com platform, you may want to start at the [Mobile SDK landing page](http://wiki.developerforce.com/page/Mobile_SDK), which offers a variety of resources to help you determine the best technology path to travel for creating your app, as well as many guides and blog posts detailing how to work with the facilities of the Mobile SDK.

But assuming you're all read up, here's how to get started with the **forceios** package, to create the starting point for your mobile application.

## Install the forceios package

As forceios is a command-line utility, we recommend installing it globally, so that it's easily accessible on your path:

        sudo npm install forceios -g

You're of course welcome to install it locally as well:

        npm install forceios

In which case you can access the forceios app at `[Install Directory]/node_modules/.bin/forceios`.

## Using forceios

For the purposes of the rest of this document, we'll assume that `forceios` is on your path.

Typing `forceios` with no arguments will give you a breakdown of the usage:

        $ forceios
        Usage:
        forceios create
            --apptype=<Application Type> (native, hybrid_remote, hybrid_local)
            --appname=<Application Name>
            --companyid=<Company Identifier> (com.myCompany.myApp)
            --organization=<Organization Name> (Your company's/organization's name)
            --apexpage=<App Start Page> (The start page of your remote app. Only required for hybrid_remote)
            [--outputdir=<Output directory> (Defaults to the current working directory)]
            [--appid=<Salesforce App Identifier> (The Consumer Key for your app. Defaults to the sample app.)]
            [--callbackuri=<Salesforce App Callback URL (The Callback URL for your app. Defaults to the sample app.)]

**Note:** You can specify any or all of the options as command line options as specified in the usage, *or* you can run `forceios create` without some or all of the arguments, and it will prompt you for each missing option interactively.

Once the creation script completes, you'll have a fully functioning "sample" application of the type you specified, in the form of an Xcode project, which you can peruse, run, and debug through.

### forceios create options

**App Type:** The type of application you wish to develop:

- **native** — A fully native iOS application
- **hybrid\_remote** — A hybrid application, based on the [Cordova](http://cordova.apache.org/) framework, where the app contents live in the cloud as a [Visualforce](http://wiki.developerforce.com/page/An_Introduction_to_Visualforce) application
- **hybrid\_local** — A hybrid application, based on the Cordova framework, where the app contents are developed locally in the Xcode project, and are deployed to the device itself when the app is built

**App Name:** The name of your application

**Company ID:** A "prefix" identifier for your company.  This concatenated with the app name will be the unique identifier for your app in the App Store.  An example would be `com.acme.mobile_apps`.

**Organization:** The name of your company or organziation.  For example, `Acme Widgets, Inc.`.

**Apex Page:** \(*Required for **hybrid\_remote** apps only*\) The "starting page" of your application on salesforce.com.  This is the entry point of your remote application, though it's only the path, not the server portion of the URL.  For instance, `/apex/MyVisualforceStartPage`.

**Output Directory:** \(*optional*\) The directory where you want your app to be created.  If not specified, it will be created in your current working directory.

**App ID:** \(*optional*\) The Connected App Consumer Key that identifies your app in the cloud.  This will default to a sample key that will allow you to test your app.  However, you *must* specify your own Consumer Key before you submit your app to the App Store.

**Callback URI:** \(*optional*\) The Callback URL associated with your Connected App.  As with the App ID, this will default to a value for a sample app, but you *must* specify your own Callback URL before you submit your app to the App Store.

## More information

- The Salesforce Mobile SDK for Android (and package) source repository lives [here](https://github.com/forcedotcom/SalesforceMobileSDK-Android).

- See [our developerforce site](http://wiki.developerforce.com/page/Mobile_SDK) for more information about how you can leverage the Salesforce Mobile SDK with the force.com platform.
