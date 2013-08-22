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
 *
 */

namespace Lfnds\Test\Unit\Configuration;

use Lfnds\Configuration\BaseConfiguration;
use Lfnds\Exception\ElefundsException;
use PHPUnit_Framework_TestCase;

require_once __DIR__ . '/../../../Configuration/BaseConfiguration.php';
require_once __DIR__ . '/../../../Communication/RestInterface.php';
require_once __DIR__ . '/../../../View/ViewInterface.php';

/**
 * Unit Test for BaseConfiguration.
 *
 * @package    elefunds API PHP Library
 * @subpackage Test
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class BaseConfigurationTest extends PHPUnit_Framework_TestCase
{


    /**
     * @var BaseConfiguration
     */
    protected $baseConfiguration;

    /**
     * setApiUrlTrimsSlashesFromUrlIfExists
     *
     * @test
     */
    public function setApiUrlTrimsSlashesFromUrlIfExists()
    {
        $this->baseConfiguration = new BaseConfiguration();

        $this->baseConfiguration->setApiUrl('http://elefunds.de/');
        $this->assertSame('http://elefunds.de', $this->baseConfiguration->getApiUrl());

        $this->baseConfiguration->setApiUrl('http://elefunds.de');
        $this->assertSame('http://elefunds.de', $this->baseConfiguration->getApiUrl());

    }

    /**
     * setClientCalculatesHashedKeyIfApiKeyIsAlreadySetAndGettersForClientIdAndHashedKeyAreWorking
     *
     * @test
     */
    public function setClientCalculatesHashedKeyIfApiKeyIsAlreadySetAndGettersForClientIdAndHashedKeyAreWorking()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->setApiKey('asdfaAdf123ddddddddd');
        $this->baseConfiguration->setClientId(1234);

        $this->assertSame(1234, $this->baseConfiguration->getClientId());
        $this->assertSame('3382a100edcb335c6af4efc1d5fb37b4ec264553', $this->baseConfiguration->getHashedKey());
    }


    /**
     * setApiKeyCalculatesHashedKeyIfClientIdIsAlreadySet
     *
     * @test
     */
    public function setApiKeyCalculatesHashedKeyIfClientIdIsAlreadySet()
    {
        $this->baseConfiguration = new BaseConfiguration();

        $this->baseConfiguration->setClientId(1234);
        $this->baseConfiguration->setApiKey('asdfaAdf123ddddddddd');

        $this->assertSame('3382a100edcb335c6af4efc1d5fb37b4ec264553', $this->baseConfiguration->getHashedKey());
    }

    /**
     * getHashedKeyThrowsErrorIfNotClientIdAndApiKeyAreSet
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getHashedKeyThrowsErrorIfNotClientIdAndApiKeyAreSet()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->getHashedKey();

    }

    /**
     * Tests if the view can be set.
     *
     * @test
     */
    public function setViewWorks()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $view = $this->getMock('Lfnds\View\ViewInterface');

        $this->baseConfiguration->setView($view);
        $this->assertSame($view, $this->baseConfiguration->getView());
    }

    /**
     * setRestImplementationWorks
     *
     * @test
     */
    public function setRestImplementationWorks()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $this->baseConfiguration->setRestImplementation($rest);
        $this->assertSame($rest, $this->baseConfiguration->getRestImplementation());
    }

    /**
     * setDonationClassNameAcceptsOnlyLoadedClasses
     *
     * @test
     */
    public function setDonationClassNameAcceptsOnlyLoadedClasses()
    {
        $this->baseConfiguration = new BaseConfiguration();

        // Interface reqs are tested by the factory, so we can pass any class here.
        $this->baseConfiguration->setDonationClassName('Lfnds\Test\Unit\Configuration\BaseConfigurationTest');
        $this->assertSame('Lfnds\Test\Unit\Configuration\BaseConfigurationTest', $this->baseConfiguration->getDonationClassName());
    }

    /**
     * setDonationClassNameThrowsErrorIfClassIsNotLoaded
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function setDonationClassNameThrowsErrorIfClassIsNotLoaded()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->setDonationClassName('Some\Made\Up\ClassName');
    }

    /**
     * setReceiverClassNameAcceptsOnlyLoadedClasses
     *
     * @test
     */
    public function setReceiverClassNameAcceptsOnlyLoadedClasses()
    {
        $this->baseConfiguration = new BaseConfiguration();

        // Interface reqs are tested by the factory, so we can pass any class here.
        $this->baseConfiguration->setReceiverClassName('Lfnds\Test\Unit\Configuration\BaseConfigurationTest');
        $this->assertSame('Lfnds\Test\Unit\Configuration\BaseConfigurationTest', $this->baseConfiguration->getReceiverClassName());
    }

    /**
     * setReceiverClassNameThrowsErrorIfClassIsNotLoaded
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function setReceiverClassNameThrowsErrorIfClassIsNotLoaded()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->setReceiverClassName('Some\Made\Up\ClassName');
    }

    /**
     * setCountrycodeAcceptsCountrycodeAsString
     *
     * @test
     */
    public function setCountrycodeAcceptsCountrycodeAsString()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->setCountrycode('de');
        $this->assertSame('de', $this->baseConfiguration->getCountrycode());
    }

    /**
     * setLanguageThrowsErrorIfGivenParamIsNotACountrycode
     *
     * @test
     * @expectedException \InvalidArgumentException
     */
    public function setLanguageThrowsErrorIfGivenParamIsNotACountrycode()
    {
        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->setCountrycode('This is not a countrycode.');
    }

    /**
     * setVersionAndModuleIdentifierSetACorrectString
     *
     * @test
     */
    public function setVersionAndModuleIdentifierSetACorrectString()
    {
        $rest = $this->getMock('Lfnds\Communication\RestInterface');
        $rest->expects($this->once())
            ->method('setUserAgent')
            ->with('elefunds-magento v1.9.9');

        $this->baseConfiguration = new BaseConfiguration();
        $this->baseConfiguration->setRestImplementation($rest)
            ->setVersionAndModuleIdentifier('1.9.9', 'elefunds-magento');

    }


}
