/**
 * @license
 * Copyright 2023 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview This file contains integration tests for ChromeApiProvider.
 */
goog.require('GoogleSmartCard.ConnectorApp.ChromeApiProvider');
goog.require('GoogleSmartCard.ConnectorApp.MockChromeApi');
goog.require('GoogleSmartCard.IntegrationTestController');
goog.require('GoogleSmartCard.PcscLiteServerClientsManagement.ReadinessTracker');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');

goog.setTestOnly();

goog.scope(function() {

const GSC = GoogleSmartCard;
const ChromeApiProvider = GSC.ConnectorApp.ChromeApiProvider;
const MockChromeApi = GSC.ConnectorApp.MockChromeApi;
const ReadinessTracker = GSC.PcscLiteServerClientsManagement.ReadinessTracker;

/**
 * @typedef {{sCardContext: number}}
 */
let EstablishContextResult;

const EMPTY_CONTEXT_RESULT = {
  'sCardContext': 0
};

/** @type {GSC.IntegrationTestController?} */
let testController;
/** @type {GSC.LibusbProxyReceiver?} */
let libusbProxyReceiver;
/** @type {ReadinessTracker?} */
let pcscReadinessTracker;
/** @type {MockChromeApi?} */
let mockChromeApi;
/** @type {!goog.testing.MockControl|undefined} */
let mockControl;

/**
 * @param {!Array} initialDevices
 * @return {!Promise}
 */
async function launchPcscServer(initialDevices) {
  await testController.setUpCppHelper(
      'SmartCardConnectorApplicationTestHelper', initialDevices);
}

function createChromeApiProvider() {
  // Note: the reference to the created provider is not stored anywhere,
  // because it manages its lifetime itself, based on the lifetime of the
  // passed message channel.
  new ChromeApiProvider(
      testController.executableModule.getMessageChannel(),
      pcscReadinessTracker.promise);
}

/**
 * Sets expectation that reportEstablishContextResult will be called for given
 * `requestId` with result code equal to `resultCode`. Sets the received result
 * to `outResult`.
 * @param {number} requestId
 * @param {string} resultCode
 * @param {!EstablishContextResult} outResult
 */
function expectReportEstablishContext(requestId, resultCode, outResult) {
  chrome
      .smartCardProviderPrivate['reportEstablishContextResult'](
          requestId, goog.testing.mockmatchers.isNumber, resultCode)
      .$once()
      .$does(
          (requestId, context,
           resultCode) => {outResult.sCardContext = context});
}

/**
 * Sets expectation that reportEstablishContextResult will be called for given
 * `requestId` with result code equal to `resultCode`.
 * @param {number} requestId
 * @param {string} resultCode
 */
function expectReportReleaseContext(requestId, resultCode) {
  chrome
      .smartCardProviderPrivate['reportReleaseContextResult'](
          requestId, resultCode)
      .$once()
}

/**
 * Sets expectation that reportListReadersResult will be called with given
 * parameters.
 * @param {number} requestId
 * @param {Array.<string>} readers
 * @param {string} resultCode
 */
function expectReportListReaders(requestId, readers, resultCode) {
  chrome
      .smartCardProviderPrivate['reportListReadersResult'](
          requestId, readers, resultCode)
      .$once();
}

goog.exportSymbol('testChromeApiProviderToCpp', {
  'setUp': async function() {
    // Set up the controller and load the C/C++ executable module.
    testController = new GSC.IntegrationTestController();
    await testController.initAsync();
    // Stub out libusb receiver.
    libusbProxyReceiver = new GSC.LibusbProxyReceiver(
        testController.executableModule.getMessageChannel());
    libusbProxyReceiver.addHook(new GSC.TestingLibusbSmartCardSimulationHook(
        testController.executableModule.getMessageChannel()));
    // Set up observers.
    pcscReadinessTracker = new ReadinessTracker(
        testController.executableModule.getMessageChannel());
    // Mock chrome.smartCardProviderPrivate API.
    mockControl = new goog.testing.MockControl();
    mockChromeApi =
        new MockChromeApi(mockControl, testController.propertyReplacer);
  },

  'tearDown': async function() {
    try {
      await testController.disposeAsync();
      pcscReadinessTracker.dispose();
    } finally {
      // Check all mock expectations are satisfied.
      mockControl.$verifyAll();
      pcscReadinessTracker = null;
      testController = null;
    }
  },

  'testSmoke': async function() {
    mockControl.$replayAll();
    launchPcscServer(/*initialDevices=*/[]);
    createChromeApiProvider();
    await pcscReadinessTracker.promise;
  },

  // Test a single `onEstablishContextRequested` event.
  'testEstablishContext': async function() {
    let establishContextResult = EMPTY_CONTEXT_RESULT;
    expectReportEstablishContext(
        /*requestId=*/ 123, 'SUCCESS', establishContextResult);
    mockControl.$replayAll();

    launchPcscServer(/*initialDevices=*/[]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onEstablishContextRequested', /*requestId=*/ 123);
    await chrome.smartCardProviderPrivate['reportEstablishContextResult']
        .$waitAndVerify();
  },

  // Test releasing the established context.
  'testReleaseContext': async function() {
    let establishContextResult = EMPTY_CONTEXT_RESULT;
    expectReportEstablishContext(
        /*requestId=*/ 123, 'SUCCESS', establishContextResult);
    expectReportReleaseContext(/*requestId=*/ 124, 'SUCCESS');
    mockControl.$replayAll();

    launchPcscServer(/*initialDevices=*/[]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onEstablishContextRequested', /*requestId=*/ 123);
    await chrome.smartCardProviderPrivate['reportEstablishContextResult']
        .$waitAndVerify();
    mockChromeApi.dispatchEvent(
        'onReleaseContextRequested', /*requestId=*/ 124,
        establishContextResult.sCardContext);
    await chrome.smartCardProviderPrivate['reportReleaseContextResult']
        .$waitAndVerify();
  },

  // Test that releasing bogus context returns INVALID_HANDLE error.
  'testReleaseContext_none': async function() {
    const BAD_CONTEXT = 123;
    expectReportReleaseContext(/*requestId=*/ 42, 'INVALID_HANDLE');
    mockControl.$replayAll();

    launchPcscServer(/*initialDevices=*/[]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onReleaseContextRequested', /*requestId=*/ 42, BAD_CONTEXT);
    await chrome.smartCardProviderPrivate['reportReleaseContextResult']
        .$waitAndVerify();
  },

  // Test ListReaders with no readers attached.
  'testListReaders_none': async function() {
    let establishContextResult = EMPTY_CONTEXT_RESULT;
    expectReportEstablishContext(
        /*requestId=*/ 123, 'SUCCESS', establishContextResult);
    expectReportListReaders(/*requestId=*/ 124, [], 'NO_READERS_AVAILABLE');
    mockControl.$replayAll();

    launchPcscServer(/*initialDevices=*/[]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onEstablishContextRequested', /*requestId=*/ 123);
    await chrome.smartCardProviderPrivate['reportEstablishContextResult']
        .$waitAndVerify();
    mockChromeApi.dispatchEvent(
        'onListReadersRequested', /*requestId=*/ 124,
        establishContextResult.sCardContext);
    await chrome.smartCardProviderPrivate['reportListReadersResult']
        .$waitAndVerify();
  },

  // Test that ListReaders requested with already released context returns
  // INVALID_HANDLE error.
  'testListReaders_releasedContext': async function() {
    let establishContextResult = EMPTY_CONTEXT_RESULT;
    expectReportEstablishContext(
        /*requestId=*/ 123, 'SUCCESS', establishContextResult);
    expectReportReleaseContext(/*requestId=*/ 124, 'SUCCESS');
    expectReportListReaders(/*requestId=*/ 125, [], 'INVALID_HANDLE');
    mockControl.$replayAll();

    launchPcscServer(/*initialDevices=*/[]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onEstablishContextRequested', /*requestId=*/ 123);
    await chrome.smartCardProviderPrivate['reportEstablishContextResult']
        .$waitAndVerify();
    mockChromeApi.dispatchEvent(
        'onReleaseContextRequested', /*requestId=*/ 124,
        establishContextResult.sCardContext);
    await chrome.smartCardProviderPrivate['reportReleaseContextResult']
        .$waitAndVerify();
    mockChromeApi.dispatchEvent(
        'onListReadersRequested', /*requestId=*/ 125,
        establishContextResult.sCardContext);
    await chrome.smartCardProviderPrivate['reportListReadersResult']
        .$waitAndVerify();
  },

  // Test ListReaders returns a one-item list when there's a single attached
  // device.
  'testListReaders_singleDevice': async function() {
    let establishContextResult = EMPTY_CONTEXT_RESULT;
    expectReportEstablishContext(
        /*requestId=*/ 123, 'SUCCESS', establishContextResult);
    expectReportListReaders(
        /*requestId=*/ 124, ['Gemalto PC Twin Reader 00 00'], 'SUCCESS');
    mockControl.$replayAll();

    launchPcscServer(
        /*initialDevices=*/[{'id': 123, 'type': 'gemaltoPcTwinReader'}]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onEstablishContextRequested', /*requestId=*/ 123);
    await chrome.smartCardProviderPrivate['reportEstablishContextResult']
        .$waitAndVerify();
    mockChromeApi.dispatchEvent(
        'onListReadersRequested', /*requestId=*/ 124,
        establishContextResult.sCardContext);
    await chrome.smartCardProviderPrivate['reportListReadersResult']
        .$waitAndVerify();
  },


  // Test ListReaders returns a two-item list when there're two attached device.
  'testListReaders_twoDevices': async function() {
    let establishContextResult = EMPTY_CONTEXT_RESULT;
    expectReportEstablishContext(
        /*requestId=*/ 123, 'SUCCESS', establishContextResult);
    expectReportListReaders(
        /*requestId=*/ 124,
        [
          'Gemalto PC Twin Reader 00 00',
          'Dell Dell Smart Card Reader Keyboard 01 00'
        ],
        'SUCCESS');
    mockControl.$replayAll();

    launchPcscServer(
        /*initialDevices=*/[
          {'id': 101, 'type': 'gemaltoPcTwinReader'},
          {'id': 102, 'type': 'dellSmartCardReaderKeyboard'}
        ]);
    createChromeApiProvider();
    mockChromeApi.dispatchEvent(
        'onEstablishContextRequested', /*requestId=*/ 123);
    await chrome.smartCardProviderPrivate['reportEstablishContextResult']
        .$waitAndVerify();
    mockChromeApi.dispatchEvent(
        'onListReadersRequested', /*requestId=*/ 124,
        establishContextResult.sCardContext);
    await chrome.smartCardProviderPrivate['reportListReadersResult']
        .$waitAndVerify();
  },
});
});  // goog.scope