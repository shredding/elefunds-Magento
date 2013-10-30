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

namespace Lfnds;

use Lfnds\Configuration\ConfigurationInterface;
use Lfnds\Exception\ElefundsCommunicationException;
use Lfnds\Exception\ElefundsException;
use Lfnds\Model\DonationInterface;
use Lfnds\Model\Factory as ModelFactory;
use Lfnds\Model\ReceiverInterface;

require_once __DIR__ . '/Model/Factory.php';
require_once __DIR__ . '/FacadeInterface.php';


/**
 * Elefunds Facade with access to the entire API functionality.
 *
 * @package    elefunds API PHP Library
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Facade implements FacadeInterface {

      /**
       * @var ConfigurationInterface
       */
      protected $configuration;
     /**
      * The cached receivers response - during one process there should only be one call.
      *
      * @var array
      */
     protected $cachedReceivers = array();

      /**
       * Sets up the facade and initializes configuration (if set).
       *
       * @param ConfigurationInterface $configuration
       */
      public function __construct(ConfigurationInterface $configuration = NULL) {
          if ($configuration !== NULL) {
              $this->setConfiguration($configuration);
          }
      }

     /**
      * Returns a brand new donation.
      *
      * @return DonationInterface
      */
      public function createDonation() {
          return ModelFactory::getDonation();
      }

    /**
     * Returns the available receivers
     *
     * @throws ElefundsCommunicationException
     * @return array
     */
     public function getReceivers() {

            if (count($this->cachedReceivers) === 0) {
                $restUrl = $this->configuration->getApiUrl() . '/receivers/for/' . $this->configuration->getClientId();
                $rawJson = $this->configuration->getRestImplementation()->get($restUrl);

                $response = json_decode($rawJson, TRUE);
                $this->cachedReceivers = $response;
            }

            // Let's get the country specific receivers
            if (!isset($this->cachedReceivers['receivers'][$this->configuration->getCountrycode()])) {
                throw new ElefundsCommunicationException(
                    'Requested countrycode was not available. Available country codes are: ' . implode(', ', array_keys($this->cachedReceivers['receivers'])) . '.',
                    1347966301
                );
            }

            $receivers = array();

            foreach ($this->cachedReceivers['receivers'][$this->configuration->getCountrycode()] as $rec) {
                $receiver = $this->createReceiver();
                $receivers[] = $receiver->setId($rec['id'])
                                        ->setName($rec['name'])
                                        ->setDescription($rec['description'])
                                        ->setImages($rec['images']);
            }

            return $receivers;
      }

     /**
      * Returns a brand new Receiver.
      *
      * @return ReceiverInterface
      */
      public function createReceiver() {
          return ModelFactory::getReceiver();
      }

     /**
      * Adds a single Donation to the API.
      *
      * This is just a wrapper for the addDonations method.
      *
      * @param Model\DonationInterface $donation
      * @return string Message returned from the API
      */
      public function addDonation(DonationInterface $donation) {
          return $this->addDonations(array($donation));
      }

      /**
       * Sends an array of donations to the API.
       *
       * @param array $donations
       * @throws ElefundsCommunicationException if connection or authentication fails or retrieved http code is not 200
       * @return string Message returned from the API
       */
      public function addDonations(array $donations) {

          if (count($donations) > 0) {
              $restUrl = $this->configuration->getApiUrl() . '/donations/?clientId=' . $this->configuration->getClientId() . '&hashedKey=' . $this->configuration->getHashedKey();
              $donationsArray = array();

              foreach ($donations as $donation) {
                  $donationsArray[] = $this->mapDonationToArray($donation);
              }

              $body = json_encode($donationsArray);

              $response = json_decode($this->configuration->getRestImplementation()->post($restUrl, $body), TRUE);
              return $response['message'];
          } else {
              return 'No donations given.';
          }
      }

      /**
       * Returns the configuration instance.
       *
       * @return ConfigurationInterface
       */
      public function getConfiguration() {
          return $this->configuration;
      }

      /**
       * Sets the configuration.
       *
       * @param ConfigurationInterface $configuration
       * @return FacadeInterface
       */
      public function setConfiguration(ConfigurationInterface $configuration) {
          $this->configuration = $configuration;
          $this->configuration->setFacade($this);
          $this->configuration->init();
          return $this;
      }

      /**
       * Cancels a single Donation at the API.
       *
       * This is just a wrapper for the cancelDonations method.
       *
       * @param mixed $donation either a foreignId (string) or instance of \Lfnds\Model\DonationInterface
       * @throws ElefundsCommunicationException if connection or authentication fails or retrieved http code is not 200
       * @return string Message returned from the API
       */
      public function cancelDonation($donation) {
          return $this->cancelDonations(array($donation));
      }

      /**
       * Cancels an array of donation from the API.
       *
       * The API requires only the foreignID, so the array must contain foreignIds or donations
       * (a mixture is possible as well).
       *
       * @param array $donations
       *
       * @throws ElefundsCommunicationException if connection or authentication fails or retrieved http code is not 200
       * @return string Message returned from the API
       */
      public function cancelDonations(array $donations) {

          if (count($donations) > 0) {
              $donationIds = array_map(function($donation) {
                  if (is_a($donation, 'Lfnds\Model\DonationInterface')) {
                      /** @var \Lfnds\Model\DonationInterface $donation*/
                      return $donation->getForeignId();
                  } else {
                      return (string)$donation;
                  }
              }, $donations);

              $donationIdsString = implode(',', $donationIds);

              $restUrl = $this->configuration->getApiUrl() . '/donations/' . $donationIdsString . '/?clientId=' . $this->configuration->getClientId() . '&hashedKey=' . $this->configuration->getHashedKey();

              $response = json_decode($this->configuration->getRestImplementation()->delete($restUrl), TRUE);
              return $response['message'];
          } else {
              return 'No donations given.';
          }
      }

    /**
     * Completes a single Donation in the API.
     *
     * This is just a wrapper for the completeDonations method.
     *
     * @param mixed $donation either a foreignId (string) or instance of \Lfnds\Model\DonationInterface
     * @throws ElefundsCommunicationException if connection or authentication fails or retrieved http code is not 200
     * @return string Message returned from the API
     */
    public function completeDonation($donation) {
        return $this->completeDonations(array($donation));
    }

    /**
     * Completes an array of Donations in the API.
     *
     * The API requires only the foreignID, so the array must contain foreignIds or donations
     * (a mixture is possible as well).
     *
     * @param array $donations
     *
     * @return string Message returned from the API
     */
    public function completeDonations(array $donations) {

        if (count($donations) > 0) {
            $donationIds = array_map(function($donation) {
                if (is_a($donation, 'Lfnds\Model\DonationInterface')) {
                    /** @var \Lfnds\Model\DonationInterface $donation*/
                    return $donation->getForeignId();
                } else {
                    return (string)$donation;
                }
            }, $donations);

            $donationIdsString = implode(',', $donationIds);

            $restUrl = $this->configuration->getApiUrl() . '/donations/' . $donationIdsString . '/?clientId=' . $this->configuration->getClientId() . '&hashedKey=' . $this->configuration->getHashedKey();

            $response = json_decode($this->configuration->getRestImplementation()->put($restUrl), TRUE);

            return $response['message'];
        } else {
            return 'No donations given.';
        }
    }

     /**
      * Renders the template.
      *
      * @throws ElefundsException
      * @return string The rendered HTML Snippet
      */
      public function renderTemplate() {

          $view = $this->getConfiguration()->getView();

          if ($view === NULL) {
              throw new ElefundsException('There is no template set in your configuration file. Please refer to the documentation or use one of the sample templates.', 1348051662593);
          }

          return $view->render();
      }

      /**
       * Helper function to include get nicely formatted tags for all css files, ready to add to html.
       *
       * @throws ElefundsException if no template is configured
       * @return string
       */
      public function getPrintableCssTagStrings() {

        $tagStrings = '';
        foreach ($this->getTemplateCssFiles() as $cssFile) {
            $tagStrings .= sprintf('<link rel="stylesheet" type="text/css" href="%s" />', $cssFile);
        }
        return $tagStrings;
      }

      /**
       * Returns the CSS Files required by the template.
       *
       * @throws ElefundsException if no template is configured
       * @return array with css files (path relative to this library)
       */
      public function getTemplateCssFiles() {
           $view = $this->getConfiguration()->getView();
            if ($view === NULL) {
                 throw new ElefundsException('There is no template set in your configuration file. Please refer to the documentation or use one of the sample templates.', 1348051662593);
            } else {
                return $view->getCssFiles();
            }
      }

      /**
       * Returns the Javascript Files required by the template.
       *
       * @throws ElefundsException if no template is configured
       * @return array with javascript files (path relative to this library)
       */
      public function getTemplateJavascriptFiles() {
           $view = $this->getConfiguration()->getView();
            if ($view === NULL) {
                 throw new ElefundsException('There is no template set in your configuration file. Please refer to the documentation or use one of the sample templates.', 1348051662593);
            } else {
                return $view->getJavascriptFiles();
            }
      }

    /**
     * Helper function to include get nicely formatted tags for all js files, ready to add to html.
     *
     * @throws ElefundsException if no template is configured
     * @return string
     */
    public function getPrintableJavascriptTagStrings() {
        $tagStrings = '';
        foreach ($this->getTemplateJavascriptFiles() as $jsFile) {
            $tagStrings .= sprintf('<script type="text/javascript" src="%s"></script>', $jsFile);
        }
        return $tagStrings;
    }

    public function getReceiptDisclaimer() {
        $countryCode = $this->configuration->getCountrycode();
        if (!isset($countryCode)) {
            throw new ElefundsCommunicationException(
                'Country code is not set.',
                1347966302
            );
        }

        $path = __DIR__ . '/Legal/ReceiptDisclaimer_' . $countryCode . '.txt';
        if (is_readable($path)) {
            $content = file_get_contents($path);
        } else {
            throw new ElefundsException(
                'Terms of service do not exist for the given country code.',
                1347966304
            );
        }

        return str_replace('\\n', '<br />', $content);
    }

    public function getTermsOfService() {
        $countryCode = $this->configuration->getCountrycode();
        if (!isset($countryCode)) {
            throw new ElefundsCommunicationException(
                'Country code is not set.',
                1347966303
            );
        }

        $path = __DIR__ . '/Legal/TermsOfService_' . $countryCode . '.txt';
        if (is_readable($path)) {
            $content = file_get_contents($path);
        } else {
            throw new ElefundsException(
                'Terms of service do not exist for the given country code.',
                1347966305
            );
        }

        return str_replace('\\n', '<br />', $content);
    }

    /**
     * Maps a DonationInterface to a JSON ready array.
     *
     * @param Model\DonationInterface $donation
     * @throws Exception\ElefundsException
     * @return array
     */
    protected function mapDonationToArray(DonationInterface $donation) {

        if ($donation->getForeignId() === NULL || $donation->getTime() === NULL || $donation->getAmount() === NULL || $donation->getReceiverIds() === NULL || $donation->getAvailableReceiverIds() === NULL) {
            throw new ElefundsException('Given donation does not contain all information needed to be send to the API.', 1347975987321);
        }

        $donationAsArray = $donation->toArray();

        if (isset($donationAsArray['donator']) && !isset($donationAsArray['donator']['countryCode'])) {
            $donationAsArray['donator']['countryCode'] = $this->getConfiguration()->getCountrycode();
        }

        return $donationAsArray;
    }

}
