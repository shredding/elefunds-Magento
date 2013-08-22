<?php

/**
 * elefunds API PHP Library
 *
 * Copyright (c) 2012 - 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

namespace Lfnds\Test\Unit\Communication;
use Lfnds\Communication\CurlRequest;
use Lfnds\Exception\ElefundsCommunicationException;
use ReflectionClass;

require_once __DIR__ . '/curlMock.php';
require_once __DIR__ . '/../../../Communication/CurlRequest.php';
require_once __DIR__ . '/../../../Exception/ElefundsCommunicationException.php';


/**
 * Unit Test for CurlRequest.
 *
 * @package    elefunds API PHP Library
 * @subpackage Test
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class CurlRequestTest extends \PHPUnit_Framework_TestCase {

    /**
     * @var CurlRequest
     */
    private $curl;

    /**
     * Set up the curl request tests.
     */
    public function setUp() {
        global $curlMockResponses;
        $curlMockResponses = [
            'curl_exec'     => 'Yeah, it works',
            'curl_getinfo'  => 200,
            'curl_loaded'   => TRUE
        ];
    }


    /**
     * Throws an exception if curl is not installed.
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function exceptionIsThrownIfCurlIsNotInstalled() {
        global $curlMockResponses;
        $curlMockResponses['curl_loaded'] = FALSE;
        new CurlRequest();
    }

    /**
     * Initializes the basic curl mock for get, post, put and delete.
     */
    public function initCurl() {
        $this->curl = $this->getMock('Lfnds\Communication\CurlRequest', ['performRequest'], [], '', FALSE);
        $this->curl->expects($this->once())
            ->method('performRequest')
            ->will($this->returnValue('requestPerformed'));

        $reflectionClass = new ReflectionClass('Lfnds\Communication\CurlRequest');

        $reflectionProperty = $reflectionClass->getProperty('curlOptions');
        $reflectionProperty->setAccessible(TRUE);
        $reflectionProperty->setValue($this->curl, array());
    }

    /**
     * getSetsHttpMethodAndURLBeforeItPerformsTheRequest
     *
     * @test
     */
    public function getSetsHttpMethodAndURLBeforeItPerformsTheRequest() {
        $this->initCurl();
        $response = $this->curl->get('https://connect.elefunds.de');
        $options = $this->getCurlOptions();

        $this->assertSame('requestPerformed', $response);
        $this->assertSame('GET', $options[CURLOPT_CUSTOMREQUEST]);
        $this->assertSame('https://connect.elefunds.de', $options[CURLOPT_URL]);
    }

    /**
     * postSetsHttpMethodHeaderBodyAndURLBeforeItPerformsTheRequest
     *
     * @test
     */
    public function postSetsHttpMethodHeaderBodyAndURLBeforeItPerformsTheRequest() {
        $this->initCurl();
        $response = $this->curl->post('https://connect.elefunds.de', 'Some body');
        $options = $this->getCurlOptions();

        $this->assertSame('requestPerformed', $response);
        $this->assertSame('POST', $options[CURLOPT_CUSTOMREQUEST]);
        $this->assertSame('https://connect.elefunds.de', $options[CURLOPT_URL]);
        $this->assertSame('Some body', $options[CURLOPT_POSTFIELDS]);
        $this->assertSame(array('Content-Type: application/json'), $options[CURLOPT_HTTPHEADER]);
    }

    /**
     * putSetsHttpMethodHeaderBodyAndURLBeforeItPerformsTheRequest
     *
     * @test
     */
    public function putSetsHttpMethodHeaderBodyAndURLBeforeItPerformsTheRequest() {
        $this->initCurl();
        $response = $this->curl->put('https://connect.elefunds.de', 'Some body');
        $options = $this->getCurlOptions();

        $this->assertSame('requestPerformed', $response);
        $this->assertSame('PUT', $options[CURLOPT_CUSTOMREQUEST]);
        $this->assertSame('https://connect.elefunds.de', $options[CURLOPT_URL]);
        $this->assertSame('Some body', $options[CURLOPT_POSTFIELDS]);
        $this->assertSame(array('Content-Type: application/json'), $options[CURLOPT_HTTPHEADER]);
    }

    /**
     * deleteSetsHttpMethodAndURLBeforeItPerformsTheRequest
     *
     * @test
     */
    public function deleteSetsHttpMethodAndURLBeforeItPerformsTheRequest() {
        $this->initCurl();
        $response = $this->curl->delete('https://connect.elefunds.de');
        $options = $this->getCurlOptions();

        $this->assertSame('requestPerformed', $response);
        $this->assertSame('DELETE', $options[CURLOPT_CUSTOMREQUEST]);
        $this->assertSame('https://connect.elefunds.de', $options[CURLOPT_URL]);
    }

    /**
     * We mocked curl_setopt_array in curlMock.php, it would throw an
     * InvalidArgumentException, if not all defaults and options are set.
     *
     * @test
     */
    public function performRequestSetsAdditionalOptionsAndDefaultsAndResetsCurlOptions() {
        $this->curl = new CurlRequest();
        $this->curl->get('https://connect.elefunds.de');
        $this->assertSame(0, count($this->getCurlOptions()));
    }

    /**
     * performRequestThrowsElefundsCommunicationExceptionOnServerFailure
     *
     * @expectedException \Lfnds\Exception\ElefundsCommunicationException
     * @test
     */
    public function performRequestThrowsElefundsCommunicationExceptionOnServerFailure() {
        global $curlMockResponses;
        $curlMockResponses['curl_exec'] = FALSE;
        $this->curl = new CurlRequest();
        $this->curl->get('https://connect.elefunds.de');
    }

    /**
     * performRequestThrowsElefundsCommunicationExceptionIfResponseCodeIsNot200
     *
     * @expectedException \Lfnds\Exception\ElefundsCommunicationException
     * @test
     */
    public function performRequestThrowsElefundsCommunicationExceptionIfResponseCodeIsNot200() {
        global $curlMockResponses;
        $curlMockResponses['curl_getinfo'] = 500;
        $this->curl = new CurlRequest();
        $this->curl->get('https://connect.elefunds.de');
    }

    /**
     * setUserAgentSetCurlUserAgentOption
     *
     * @test
     */
    public function setUserAgentSetCurlUserAgentOption() {
        $this->curl = new CurlRequest();
        $this->curl->setUserAgent('elefunds-magento v1.2.9');
        $options = $this->getCurlOptions();
        $this->assertSame($options[CURLOPT_USERAGENT], 'elefunds-magento v1.2.9');
    }

    /**
     * Returns the protected property curlOptions
     *
     * @return array
     */
    private function getCurlOptions() {
        $reflectionClass = new ReflectionClass('Lfnds\Communication\CurlRequest');
        $reflectionProperty = $reflectionClass->getProperty('curlOptions');
        $reflectionProperty->setAccessible(TRUE);
        return $reflectionProperty->getValue($this->curl);
    }

}
