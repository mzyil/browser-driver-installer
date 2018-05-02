'use strict';
/* eslint-disable no-console */

const runNpmChildProcess = require('./runNpmChildProcess');
const path = require('path');
const execSync = require('child_process').execSync;
const shell = require('shelljs');

const TEMP_DIR = 'temp';
const CHROME_DRIVER_NAME = 'chromedriver';
const CHROME_DRIVER_BIN_PATH = path.join('node_modules', 'chromedriver', 'lib', 'chromedriver', CHROME_DRIVER_NAME);
const CHROME_DRIVER_VERSION_REGEX = new RegExp(/\w+ ([0-9]+.[0-9]+).+/);
const GECKO_DRIVER_NAME = 'geckodriver';
const GECKO_DRIVER_BIN_PATH = path.join('node_modules', 'geckodriver', GECKO_DRIVER_NAME);
const GECKO_DRIVER_VERSION_REGEX = new RegExp(/\w+\s(\d+.\d+.\d+)/);
const BROWSER_MAJOR_VERSION_REGEX = new RegExp(/^(\d+)/);

function installDriverWithVersion(driverName, driverBinPath, installPath, versionObject)
{
    if (checkDirectoryAndVersion(driverName, installPath, versionObject.driverVersion))
    {
        return false;
    }

    shell.mkdir('-p', TEMP_DIR);

    return runNpmChildProcess(['install', `${driverName}@${versionObject.driverNPMPackageVersion}`, '--prefix',
        TEMP_DIR
    ]).then(
        function ()
        {
            shell.mkdir('-p', installPath);
            shell.cp('-n', path.join(TEMP_DIR, driverBinPath), installPath);
            shell.rm('-rf', TEMP_DIR);
            console.log('package dependencies have been installed');
            return true;
        },
        function (e)
        {
            throw new Error('package dependencies installation failed with error, details: ' + e.toString());
        });
}

function checkDirectoryAndVersion(driverName, installPath, driverExpectedVersion)
{
    if (!shell.test('-e', installPath))
    {
        return false;
    }
    console.log(`Directory '${installPath}' does exist.`);
    console.log(`Checking if the directory contains a ${driverName}...`);

    if (!shell.test('-e', path.join(installPath, driverName)))
    {
        console.log(`Could not find the ${driverName} in the directory '${installPath}'. Attempting to install it...`);
        return false;
    }

    console.log(`${driverName} found.`);
    const driverMajorVersion = driverVersionString(driverName, installPath);
    if (driverMajorVersion !== driverExpectedVersion)
    {
        console.log(
            `${driverName} expected version (${driverExpectedVersion}) does not match with the installed version (${driverMajorVersion}).`
        );
        console.log('Removing the old version...');
        shell.rm(path.join(installPath, driverName));
        return false;
    }

    console.log(`${driverName} version ${driverExpectedVersion} has already been installed!`);
    return true;
}

function driverVersionString(driverName, installPath)
{
    let versionOutput = null;
    if (driverName === CHROME_DRIVER_NAME)
    {
        versionOutput = execSync(path.join(installPath, driverName) + ' -v').toString();
        return versionOutput.match(CHROME_DRIVER_VERSION_REGEX)[1];
    }
    else if (driverName === GECKO_DRIVER_NAME)
    {
        versionOutput = execSync(path.join(installPath, driverName) + ' -V').toString();
        return versionOutput.match(GECKO_DRIVER_VERSION_REGEX)[1];
    }
    else
    {
        throw new Error(`No driver exists with the name ${driverName}.`);
    }
}

function driverInstaller(detectedChromeVersion, chromeDriverTargetPath, detectedFirefoxVersion, geckoDriverTargetPath)
{
    const browserVersionsObject = JSON.parse(shell.cat(path.resolve(__dirname, 'driverVersions.json')));
    // ChromeDriver NPM package versions are defined according to https://github.com/giggio/node-chromedriver/releases
    const chromeDriverVersions = browserVersionsObject.chromeDriverVersions;

    // GeckoDriver NPM package versions are defined according to https://github.com/mozilla/geckodriver/releases
    const geckoDriverVersions = browserVersionsObject.geckoDriverVersions;

    detectedChromeVersion = majorBrowserVersion(detectedChromeVersion);
    detectedFirefoxVersion = majorBrowserVersion(detectedFirefoxVersion);

    if (detectedChromeVersion && !chromeDriverVersions[detectedChromeVersion])
    {
        throw new Error(
            `Failed to locate a version of ChromeDriver that matches the installed version of Chrome (${detectedChromeVersion}). Valid Chrome versions are: ${Object.keys(chromeDriverVersions).join(', ')}`
        );
    }
    else if (detectedChromeVersion && typeof (chromeDriverTargetPath) === 'string')
    {
        return installDriverWithVersion(CHROME_DRIVER_NAME, CHROME_DRIVER_BIN_PATH, chromeDriverTargetPath,
            chromeDriverVersions[detectedChromeVersion]);
    }
    else
    {
        console.log('No Chrome version or target path is provided. Skipping...');
    }

    if (detectedFirefoxVersion && !geckoDriverVersions[detectedFirefoxVersion])
    {
        throw new Error(
            `Failed to locate a version of GeckoDriver that matches the installed version of Firefox (${detectedFirefoxVersion}). Valid Firefox versions are: ${Object.keys(geckoDriverVersions).join(', ')}`
        );
    }
    else if (detectedFirefoxVersion && (typeof geckoDriverTargetPath) === 'string')
    {
        return installDriverWithVersion(GECKO_DRIVER_NAME, GECKO_DRIVER_BIN_PATH, geckoDriverTargetPath,
            geckoDriverVersions[
                detectedFirefoxVersion]);
    }
    else
    {
        console.log('No Firefox version or target path is provided. Skipping...');
    }

    return false;
}

function majorBrowserVersion(browserVersionString)
{
    return (typeof browserVersionString) === 'string' && browserVersionString.match(BROWSER_MAJOR_VERSION_REGEX)[0];
}

module.exports.driverInstaller = driverInstaller;