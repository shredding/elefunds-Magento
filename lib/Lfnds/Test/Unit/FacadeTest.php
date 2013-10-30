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

namespace Lfnds\Test\Unit;

use DateTime;
use Lfnds\Configuration\DefaultConfiguration;
use Lfnds\Exception\ElefundsException;
use PHPUnit_Framework_TestCase;
use Lfnds\Facade;

require_once __DIR__ . '/../../Facade.php';

/**
 * Unit Test for Elefunds_Facade
 *
 * @package    elefunds API PHP Library
 * @subpackage Test
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class FacadeTest extends PHPUnit_Framework_TestCase {

   /**
    * @var Facade
    */
   protected $facade;

    /**
     * @var DateTime
     */
    protected $uniqueTimestampForAllTests;

    /**
     * Sets up the class under test.
     */
    public function setUp() {
       $this->facade = new Facade();

       date_default_timezone_set('Europe/Berlin');
       $this->uniqueTimestampForAllTests = new DateTime();
   }

   /**
    * setConfigurationCallsInit
    *
    * @test
    */
   public function setConfigurationCallsInit() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                      ->method('init');

       $this->facade->setConfiguration($configuration);
    }

    /**
     * When a donation is persisted, there are a few properties required to be set.
     * We test that here.
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function addDonationsThrowsErrorIfDonationIsNotRichEnough() {

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getApiUrl')
            ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
            ->method('getClientId')
            ->will($this->returnValue(1234));

        $configuration->expects($this->once())
            ->method('getHashedKey')
            ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $this->facade->setConfiguration($configuration);

        $donations = array($this->getMock('Lfnds\Model\DonationInterface'));

        $this->facade->addDonations($donations);
    }

    /**
     * cancelDonationCalculatesCorrectApiUrl
     *
     * @test
     */
    public function cancelDonationCalculatesCorrectApiUrl() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                       ->method('getApiUrl')
                       ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
                      ->method('getClientId')
                      ->will($this->returnValue(1234));

        $configuration->expects($this->once())
                       ->method('getHashedKey')
                       ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
             ->method('delete')
             ->with($this->equalTo('https://api.elefunds.de/donations/1234/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
             ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
                      ->method('getRestImplementation')
                      ->will($this->returnValue($rest));


        $this->facade->setConfiguration($configuration);

        $result = $this->facade->cancelDonation(1234);
        $this->assertSame('Works like a charm!', $result);
    }

    /**
     * cancelDonationAcceptsDonationInstance
     *
     * @test
     */
    public function cancelDonationAcceptsDonationInstance() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getApiUrl')
            ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
            ->method('getClientId')
            ->will($this->returnValue(1234));

        $configuration->expects($this->once())
            ->method('getHashedKey')
            ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
            ->method('delete')
            ->with($this->equalTo('https://api.elefunds.de/donations/1234/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
            ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
            ->method('getRestImplementation')
            ->will($this->returnValue($rest));


        $this->facade->setConfiguration($configuration);

        $result = $this->facade->cancelDonation(1234);
        $this->assertSame('Works like a charm!', $result);
    }


    /**
     * completeDonationCalculatesCorrectApiUrl
     *
     * @test
     */
    public function completeDonationCalculatesCorrectApiUrl() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getApiUrl')
            ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
            ->method('getClientId')
            ->will($this->returnValue(1234));

        $configuration->expects($this->once())
            ->method('getHashedKey')
            ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
            ->method('put')
            ->with($this->equalTo('https://api.elefunds.de/donations/AB1234/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
            ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
            ->method('getRestImplementation')
            ->will($this->returnValue($rest));


        $this->facade->setConfiguration($configuration);

        $result = $this->facade->completeDonation("AB1234");
        $this->assertSame('Works like a charm!', $result);
    }

    /**
     * completeDonationAcceptsDonationInstance
     *
     * @test
     */
    public function completeDonationAcceptsDonationInstance() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getApiUrl')
            ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
            ->method('getClientId')
            ->will($this->returnValue(1234));

        $configuration->expects($this->once())
            ->method('getHashedKey')
            ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
            ->method('put')
            ->with($this->equalTo('https://api.elefunds.de/donations/AB1234/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
            ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
            ->method('getRestImplementation')
            ->will($this->returnValue($rest));


        $this->facade->setConfiguration($configuration);
        $donation = $this->facade->createDonation()->setForeignId('AB1234');
        $result = $this->facade->completeDonation($donation);
        $this->assertSame('Works like a charm!', $result);
    }

    /**
     * addDonationsCallsCorrectAPiUrl
     *
     * @test
     */
    public function addDonationsCallsCorrectAPiUrl() {

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                       ->method('getApiUrl')
                       ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
                      ->method('getClientId')
                      ->will($this->returnValue(1234));

        $configuration->expects($this->once())
                      ->method('getHashedKey')
                      ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
              ->method('post')
              ->with(
                    $this->equalTo('https://api.elefunds.de/donations/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'),
                    json_encode(
                        array(
                            array(
                                'foreignId'             =>  1234,
                                'donationTimestamp'     =>  $this->uniqueTimestampForAllTests->format(DateTime::ISO8601),
                                'donationAmount'        =>  1000,
                                'receivers'             =>  array(1,2,3),
                                'receiversAvailable'    =>  array(1,2,3)
                            )
                        )
                    )

              )
              ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
                      ->method('getRestImplementation')
                      ->will($this->returnValue($rest));

        $donation = $this->getMock('Lfnds\Model\DonationInterface');

        $donation->expects($this->any())
                  ->method('getForeignId')
                  ->will($this->returnValue(1234));

        $donation->expects($this->any())
                  ->method('toArray')
                  ->will($this->returnValue(
                        array(
                            'foreignId'             =>  1234,
                            'donationTimestamp'     =>  $this->uniqueTimestampForAllTests->format(DateTime::ISO8601),
                            'donationAmount'        =>  1000,
                            'receivers'             =>  array(1,2,3),
                            'receiversAvailable'    =>  array(1,2,3)
                        )
                   ));


        $donation->expects($this->any())
                  ->method('getTime')
                  ->will($this->returnValue($this->uniqueTimestampForAllTests));

        $donation->expects($this->any())
                  ->method('getAmount')
                  ->will($this->returnValue(1000));

        $donation->expects($this->any())
                 ->method('getReceiverIds')
                 ->will($this->returnValue(array(1,2,3)));

        $donation->expects($this->any())
                  ->method('getAvailableReceiverIds')
                  ->will($this->returnValue(array(1,2,3)));


        $this->facade->setConfiguration($configuration);
        $result = $this->facade->addDonations(array($donation));
        $this->assertSame($result, 'Works like a charm!');
    }

    /**
     * cancelDonationsCallsCorrectAPiUrl
     *
     * @test
     */
    public function cancelDonationsCallsCorrectAPiUrl() {

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                      ->method('getApiUrl')
                      ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
                      ->method('getClientId')
                      ->will($this->returnValue(1234));

        $configuration->expects($this->once())
                      ->method('getHashedKey')
                      ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
                ->method('delete')
                ->with($this->equalTo('https://api.elefunds.de/donations/1,2,3,4/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
                ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
            ->method('getRestImplementation')
            ->will($this->returnValue($rest));

        $this->facade->setConfiguration($configuration);
        $result = $this->facade->cancelDonations(array(1, 2, 3, 4));
        $this->assertSame($result, 'Works like a charm!');
    }

    /**
     * cancelDonationsAcceptsDonationsInstance
     *
     * @test
     */
    public function cancelDonationsAcceptsDonationsInstance() {

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                      ->method('getApiUrl')
                      ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
                      ->method('getClientId')
                      ->will($this->returnValue(1234));

        $configuration->expects($this->once())
                      ->method('getHashedKey')
                      ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
                ->method('delete')
                ->with($this->equalTo('https://api.elefunds.de/donations/AB1234/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
                ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
            ->method('getRestImplementation')
            ->will($this->returnValue($rest));

        $this->facade->setConfiguration($configuration);

        $donation = $this->facade->createDonation()->setForeignId('AB1234');
        $result = $this->facade->cancelDonation($donation);
        $this->assertSame($result, 'Works like a charm!');
    }

    /**
     * completeDonationsCallsCorrectAPiUrl
     *
     * @test
     */
    public function completeDonationsCallsCorrectAPiUrl() {

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getApiUrl')
            ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
            ->method('getClientId')
            ->will($this->returnValue(1234));

        $configuration->expects($this->once())
            ->method('getHashedKey')
            ->will($this->returnValue('3382a100edcb335c6af4efc1d5fb37b4ec264553'));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
            ->method('put')
            ->with($this->equalTo('https://api.elefunds.de/donations/1,2,3,4/?clientId=1234&hashedKey=3382a100edcb335c6af4efc1d5fb37b4ec264553'))
            ->will($this->returnValue(json_encode(array('message' => 'Works like a charm!'))));

        $configuration->expects($this->once())
            ->method('getRestImplementation')
            ->will($this->returnValue($rest));

        $this->facade->setConfiguration($configuration);
        $result = $this->facade->completeDonations(array(1, 2, 3, 4));
        $this->assertSame($result, 'Works like a charm!');
    }

    /**
     * getReceiversCallsCorrectApiUrlAndThrowsErrorIfWrongCountryCodeIsSet
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsCommunicationException
     */
    public function getReceiversCallsCorrectApiUrlAndThrowsErrorIfWrongCountryCodeIsSet() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                      ->method('getApiUrl')
                      ->will($this->returnValue('https://api.elefunds.de'));

        $configuration->expects($this->once())
                       ->method('getClientId')
                       ->will($this->returnValue(1234));

        $rest = $this->getMock('Lfnds\Communication\RestInterface');

        $rest->expects($this->once())
              ->method('get')
              ->with($this->equalTo('https://api.elefunds.de/receivers/for/1234'))
              ->will($this->returnValue(json_encode(
                 array(
                    'receivers' => array(
                         array(
                            'de'    =>
                            array(
                                'id'            =>  1234,
                                'name'          =>  'TestReceiver',
                                'description'   =>  'Some description',
                                'images'        =>  array(
                                        'vertical'  =>  array(
                                            'small'     =>  'http://elefunds.de/image1.jpg',
                                            'medium'    =>  'http://elefunds.de/image2.jpg',
                                            'large'     =>  'http://elefunds.de/image3.jpg',
                                        ),
                                        'horizontal'  =>  array(
                                            'small'     =>  'http://elefunds.de/image4.jpg',
                                            'medium'    =>  'http://elefunds.de/image5.jpg',
                                            'large'     =>  'http://elefunds.de/image6.jpg',
                                        )
                                )
                            )
                        )
                    )
                )
        )));

        $configuration->expects($this->once())
                       ->method('getRestImplementation')
                       ->will($this->returnValue($rest));

        $configuration->expects($this->once())
                      ->method('getCountrycode')
                      ->will($this->returnValue('de'));

        $this->facade->setConfiguration($configuration);
        $this->facade->getReceivers();

    }

    /**
     * getTemplateCssFilesReturnsArray
     *
     * @test
     */
    public function getTemplateCssFilesReturnsArray() {

        $view = $this->getMock('Lfnds\View\ViewInterface');
        $view->expects($this->once())
             ->method('getCssFiles')
             ->will($this->returnValue(array('http://path/to/css.css')));

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                       ->method('getView')
                       ->will($this->returnValue($view));

        $this->facade->setConfiguration($configuration);
        $files = $this->facade->getTemplateCssFiles();

        $this->assertSame(array('http://path/to/css.css'), $files);
    }

    /**
     * getPrintableCssReturnsTags
     *
     * @test
     */
    public function getPrintableCssReturnsTags() {
        $view = $this->getMock('Lfnds\View\ViewInterface');
        $view->expects($this->once())
            ->method('getCssFiles')
            ->will($this->returnValue(array('http://path/to/css.css')));

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getView')
            ->will($this->returnValue($view));

        $this->facade->setConfiguration($configuration);
        $tags = $this->facade->getPrintableCssTagStrings();

        $this->assertSame('<link rel="stylesheet" type="text/css" href="http://path/to/css.css">', $tags);
    }

    /**
     * renderTemplateReturnsStringFromViewIfViewIsSet
     *
     * @test
     */
    public function renderTemplateReturnsStringFromViewIfViewIsSet() {

        $view = $this->getMock('Lfnds\View\ViewInterface');
        $view->expects($this->once())
            ->method('render')
            ->will($this->returnValue('<p>Hello World!</p>'));

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getView')
            ->will($this->returnValue($view));

        $this->facade->setConfiguration($configuration);
        $html = $this->facade->renderTemplate();

        $this->assertSame('<p>Hello World!</p>', $html);
    }

    /**
     * renderTemplateThrowsErrorIfNoViewIsGiven
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function renderTemplateThrowsErrorIfNoViewIsGiven() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getView');

        $this->facade->setConfiguration($configuration);
        $this->facade->renderTemplate();
    }

    /**
     * getTemplateJavascriptFilesReturnsArray
     *
     * @test
     */
    public function getTemplateJavascriptFilesReturnsArray() {

        $view = $this->getMock('Lfnds\View\ViewInterface');
        $view->expects($this->once())
            ->method('getJavascriptFiles')
            ->will($this->returnValue(array('http://path/to/script.js')));

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getView')
            ->will($this->returnValue($view));

        $this->facade->setConfiguration($configuration);
        $files = $this->facade->getTemplateJavascriptFiles();

        $this->assertSame(array('http://path/to/script.js'), $files);
    }

    /**
     * getPrintableJavascriptReturnsTags
     *
     * @test
     */
    public function getPrintableJavascriptReturnsTags() {
        $view = $this->getMock('Lfnds\View\ViewInterface');
        $view->expects($this->once())
            ->method('getJavascriptFiles')
            ->will($this->returnValue(array('http://path/to/js.js')));

        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getView')
            ->will($this->returnValue($view));

        $this->facade->setConfiguration($configuration);
        $tags = $this->facade->getPrintableJavascriptTagStrings();

        $this->assertSame('<script type="text/javascript" src="http://path/to/js.js"></script>', $tags);
    }

    /**
     * getTemplateCssFilesThrowsErrorIfNoViewGiven
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getTemplateCssFilesThrowsErrorIfNoViewGiven() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
                      ->method('getView');

        $this->facade->setConfiguration($configuration);
        $this->facade->getTemplateCssFiles();
    }

    /**
     * getTemplateJavascriptFilesThrowsErrorIfNoViewGiven
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getTemplateJavascriptFilesThrowsErrorIfNoViewGiven() {
        $configuration = $this->getMock('Lfnds\Configuration\ConfigurationInterface');

        $configuration->expects($this->once())
            ->method('getView');

        $this->facade->setConfiguration($configuration);
        $this->facade->getTemplateJavascriptFiles();
    }

    /**
     * getReceiptDisclaimerThrowsErrorIfCountryCodeIsNotSet
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getReceiptDisclaimerThrowsErrorIfCountryCodeIsNotSet() {
        $this->facade->setConfiguration($this->getMock('Lfnds\Configuration\ConfigurationInterface'));
        $this->facade->getReceiptDisclaimer();
    }

    /**
     * getReceiptDisclaimerThrowsErrorIfDisclaimerDoesNotExistForGivenCountryCode
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getReceiptDisclaimerThrowsErrorIfDisclaimerDoesNotExistForGivenCountryCode() {
        $this->facade->setConfiguration(new DefaultConfiguration());
        $this->facade->getConfiguration()->setCountrycode('zz');
        $this->facade->getReceiptDisclaimer();
    }

    /**
     * getReceiptDisclaimerReturnsTextForTheGivenCountryCode
     * @test
     */
    public function getReceiptDisclaimerReturnsTextForTheGivenCountryCode() {
        $this->facade->setConfiguration(new DefaultConfiguration());
        $this->facade->getConfiguration()->setCountrycode('de');
        $content = $this->facade->getReceiptDisclaimer();
        $original = 'Der Spendenbetrag wird im Namen der elefunds Stiftung gUG vereinnahmt und zu 100% weitergeleitet. Dieser Kaufbeleg ersetzt keine Spendenbescheinigung im Sinne des Steuerrechts.';
        $this->assertSame($original, $content);
    }

    /**
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getTermsOfServiceThrowsErrorIfCountryCodeIsNotSet() {
        $this->facade->setConfiguration($this->getMock('Lfnds\Configuration\ConfigurationInterface'));
        $this->facade->getTermsOfService();
    }

    /**
     * getTermsOfServiceThrowsErrorIfDisclaimerDoesNotExistForGivenCountryCode
     *
     * @test
     * @expectedException \Lfnds\Exception\ElefundsException
     */
    public function getTermsOfServiceThrowsErrorIfDisclaimerDoesNotExistForGivenCountryCode() {
        $this->facade->setConfiguration(new DefaultConfiguration());
        $this->facade->getConfiguration()->setCountrycode('zz');
        $this->facade->getTermsOfService();
    }

    /**
     * getTermsOfServiceReturnsTextForTheGivenCountryCode
     *
     * @test
     */
    public function getTermsOfServiceReturnsTextForTheGivenCountryCode() {
        $this->facade->setConfiguration(new DefaultConfiguration());
        $this->facade->getConfiguration()->setCountrycode('de');
        $content = $this->facade->getTermsOfService();
        $original = str_replace('\\n', '<br />', 'Im Bezahlprozess befindet sich das von der elefunds GmbH entwickelte elefunds Spenden-Plug-In, das Ihnen die Möglichkeit gibt, abseits vom Zahlbetrag einen frei wählbaren Betrag als Spende aufzurunden. Die Aufrundung kann nach Wahl an die zur Verfügung stehenden Organisationen gespendet werden, wobei der Betrag bei Mehrfachauswahl gleichmäßig unter den spendenempfangenden Organisationen aufgeteilt wird. Bei Fragen rund um das Thema Spenden in unserem Shop können Sie sich gerne jederzeit direkt mit der elefunds GmbH in Verbindung setzen:\n\nelefunds GmbH\nSchönhauser Allee 124\n10437 Berlin\nTelefon: +49 30 48 49 24 38\nFax: +49 30 48 49 24 24\nkontakt@elefunds.de\nwww.elefunds.de\n\nMit der Aktivierung des elefunds Plug-Ins erklären Sie sich einverstanden, dass der gewählte Spendenbetrag zu Ihrem Kaufpreis hinzugefügt wird und als eigene Position auf der Rechnung erscheint. Die Spende beinhaltet keine MwSt.. Die Spende wird für Rechnung der elefunds Stiftung gUG vereinnahmt, die den Betrag zu 100% an die ausgewählten Organisationen weiterleitet. Der vorliegende Kaufbeleg ersetzt keine Spendenbescheinigung im Sinne des Steuerrechts.');
        $this->assertSame($original, $content);
    }



}
