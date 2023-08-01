# Copyright 2023 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This file contains the implementation of the ../include.mk interface that
# builds the JS-to-C++ test runner using the Emscripten toolchain.

# Below are rules for compiling the C/C++ "entry point", i.e. the
# "GoogleSmartCardModule" class that's exposed to the JS side via Embind.
#
# Note that we don't put this file into a static library, since the linker would
# prune the static initializers by default.
JS_TO_CXX_TEST_ENTRY_POINT_SOURCE := \
	$(ROOT_PATH)/common/integration_testing/src/entry_point_emscripten.cc

JS_TO_CXX_TEST_ENTRY_POINT_FLAGS := \
	-I$(ROOT_PATH)/common/cpp/src \
	-I$(ROOT_PATH)/common/integration_testing/src \
	-pedantic \
	-Wall \
	-Werror \
	-Wextra \
	-std=$(CXX_DIALECT) \

$(eval $(call COMPILE_RULE,$(JS_TO_CXX_TEST_ENTRY_POINT_SOURCE),\
	$(JS_TO_CXX_TEST_ENTRY_POINT_FLAGS)))

# Internal constant containing the list of additional C/C++ static libraries to
# link against.
JS_TO_CXX_TEST_EMSCRIPTEN_LIBS := \
	$(INTEGRATION_TESTING_LIB) \
	$(CPP_COMMON_LIB) \

# TODO(emaxx): This is duplicated with build_nacl.mk; share it via a file.
JS_TO_CXX_TEST_JS_COMPILER_INPUTS := \
	$(INTEGRATION_TESTING_JS_COMPILER_INPUT_DIR_PATHS) \
	$(JS_COMMON_JS_COMPILER_INPUT_DIR_PATHS) \

# Documented in ../include.mk.
define BUILD_JS_TO_CXX_TEST

# Target that generates the Emscripten executable module containing compiled
# C/C++ helpers.
$(eval $(call LINK_EXECUTABLE_RULE,$(1) $(JS_TO_CXX_TEST_ENTRY_POINT_SOURCE),\
	$(2) $(JS_TO_CXX_TEST_EMSCRIPTEN_LIBS)))

# Target that generates tests.js containing compiled JS tests and helpers.
$(eval $(call BUILD_TESTING_JS_SCRIPT,tests.js,\
	$(3) $(JS_TO_CXX_TEST_JS_COMPILER_INPUTS)))

endef

# Target that generates index.html.
#
# It's essentially a simple wrapper that executes the contents of tests.js.
$(OUT_DIR_PATH)/index.html: $(OUT_DIR_PATH)
	@echo "<script src='tests.js'></script>" > $(OUT_DIR_PATH)/index.html
all: $(OUT_DIR_PATH)/index.html

# Target that executes the tests via Chromedriver.
#
# Explanation of arguments:
# --serve-via-web-server: Run the tests as "localhost:<random_port>/index.html"
#   instead of just navigating to "file://.../index.html", because Chrome
#   doesn't allow loading additional JavaScript code on file:// URLs.
run_test: all
	. $(ROOT_PATH)/env/python3_venv/bin/activate && \
		$(ROOT_PATH)/common/js_test_runner/run-js-tests.py \
			$(OUT_DIR_PATH)/index.html \
			--chromedriver-path=$(ROOT_PATH)/env/chromedriver \
			--serve-via-web-server