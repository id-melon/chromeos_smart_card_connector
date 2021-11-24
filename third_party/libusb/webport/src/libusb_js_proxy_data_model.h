// Copyright 2021 Google Inc.
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA

// This file defines structures that are shared between the C++ side (the
// `LibusbJsProxy` class) and the JavaScript side (the `LibusbProxyReceiver`
// class et al.).

#ifndef GOOGLE_SMART_CARD_THIRD_PARTY_LIBUSB_LIBUSB_JS_PROXY_DATA_MODEL_H_
#define GOOGLE_SMART_CARD_THIRD_PARTY_LIBUSB_LIBUSB_JS_PROXY_DATA_MODEL_H_

#include <stdint.h>

#include <string>
#include <vector>

#include <google_smart_card_common/optional.h>

namespace google_smart_card {

// The types defined in this file must the ones defined in
// libusb-proxy-data-model.js.

struct LibusbJsDevice {
  // The device identifier. It's a transient identifier that's generated by the
  // JavaScript side and used for specifying the device in subsequent requests
  // to the JS side. It stays constant for the same physical device as long as
  // it remains attached (but it changes after the device is unplugged and then
  // plugged back).
  int64_t device_id;
  // The USB vendor ID.
  uint32_t vendor_id;
  // The USB product ID.
  uint32_t product_id;
  // The version number (according to the bcdDevice field of the USB specs), or
  // an empty optional if unavailable.
  optional<int64_t> version;
  // The USB iProduct string, or an empty optional if unavailable.
  optional<std::string> product_name;
  // The USB iManufacturer string, or an empty optional if unavailable.
  optional<std::string> manufacturer_name;
  // The USB iSerialNumber string, or an empty optional if unavailable.
  optional<std::string> serial_number;
};

enum LibusbJsDirection {
  kIn,
  kOut,
};

enum LibusbJsEndpointType {
  kBulk,
  kControl,
  kInterrupt,
  kIsochronous,
};

struct LibusbJsEndpointDescriptor {
  // The USB bEndpointAddress field.
  uint8_t endpoint_address;
  LibusbJsDirection direction;
  LibusbJsEndpointType type;
  optional<std::vector<uint8_t>> extra_data;
  // The USB wMaxPacketSize field.
  uint16_t max_packet_size;
};

struct LibusbJsInterfaceDescriptor {
  // The USB bInterfaceNumber field.
  uint8_t interface_number;
  // The USB interfaceClass field.
  uint8_t interface_class;
  // The USB interfaceSubclass field.
  uint8_t interface_subclass;
  // The USB interfaceProtocol field.
  uint8_t interface_protocol;
  optional<std::vector<uint8_t>> extra_data;
  std::vector<LibusbJsEndpointDescriptor> endpoints;
};

struct LibusbJsConfigurationDescriptor {
  // Whether the configuration is active.
  bool active;
  // The USB bConfigurationValue field.
  uint8_t configuration_value;
  optional<std::vector<uint8_t>> extra_data;
  std::vector<LibusbJsInterfaceDescriptor> interfaces;
};

}  // namespace google_smart_card

#endif  // GOOGLE_SMART_CARD_THIRD_PARTY_LIBUSB_LIBUSB_JS_PROXY_DATA_MODEL_H_
