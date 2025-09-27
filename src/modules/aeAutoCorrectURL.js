/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// RegExp for RFC2822 email validation
// Source: https://regexr.com/2rhq7
const EMAIL_ADDRESS_RE = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;


export default function aeAutoCorrectURL(aURLString)
{
  let rv = aURLString;
  let isEmailAddr = false;

  rv = rv.replace(/"/g, "%22");
  
  // Check if the string is an email address.
  if (aURLString.search(EMAIL_ADDRESS_RE) != -1) {
    isEmailAddr = true;
    if (!aURLString.startsWith("mailto:")) {
      rv = "mailto:" + aURLString;
    }
  }
  
  if (!aURLString.startsWith("http") && !aURLString.startsWith("about:") && !isEmailAddr) {
    rv = "https://" + aURLString;
  }

  return rv;
}
