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

namespace Lfnds\Test\Unit\View;

use Lfnds\Exception\ElefundsException;
use Lfnds\View\BaseView;
use PHPUnit_Framework_TestCase;
use ReflectionClass;
use stdClass;

require_once __DIR__ . '/../../../View/BaseView.php';

/**
 * Unit Test BaseView.
 * 
 * @package    elefunds API PHP Library
 * @subpackage Test
 * @author     Christian Peters <christian@elefunds.de>
 * @copyright  2012 - 2013 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class BaseViewTest extends PHPUnit_Framework_TestCase {

    /**
     * @var BaseView
     */
    protected $view;
   
  /**
   * BaseView is meant to be extended, so we have to do some tricks for proper testing ... 
   * 
   * @var ReflectionClass
   */
   protected $reflectionClass;

    /**
     * Sets up the class under test.
     */
    public function setUp() {
      $this->view = new BaseView();
      
      // Set dummy test name
      $this->view->setTemplate('Dummy');
      
      // We need some reflection for more insight here ...
      $this->reflectionClass = new ReflectionClass('Lfnds\View\BaseView');
      
    }

    /**
     * registerHooksThrowsErrorIfClassDoesNotExist
     *
     * @test
     * @expectedException \InvalidArgumentException
     */
    public function registerHooksThrowsErrorIfClassDoesNotExist() {
        $this->view->registerAssignHook('someVar', 'NonExistingClass', 'NonExistingMethod');
    }

    /**
     * registerHooksThrowsErrorIfMethodDoesNotExist
     *
     * @test
     * @expectedException \InvalidArgumentException
     */
    public function registerHooksThrowsErrorIfMethodDoesNotExist() {
        $this->view->registerAssignHook('someVar', $this, 'NonExistingMethod');
    }

    /**
     * registerHooksAddsHookIfClassAndMethodExistsAndItGetsCalledWhenAKeyIsAssigned
     *
     * @test
     */
    public function registerHooksAddsHookIfClassAndMethodExistsAndItGetsCalledWhenAKeyIsAssigned() {

        // The class itself does not matter, we could use any as hook
        $sampleClass = $this->getMock('Lfnds\View\BaseView');
        $sampleClass->expects($this->once())
                    ->method('getCssFiles');

        $this->view->registerAssignHook('someKey', $sampleClass, 'getCssFiles');
        $this->view->assign('someKey', 'someValue');

    }

   
   /**
    * setCssFilesCalculatesTheCorrectPathAndChecksForExistance
    *
    * @test
    */ 
   public function setCssFilesCalculatesTheCorrectPathAndChecksForExistance() {
     
       $additionalInformation = array();       
       try {
           $this->view->addCssFile('test.css');           
       } catch (ElefundsException $exception) {
           $additionalInformation = $exception->getAdditionalInformation();
       }
       
       $this->assertSame('Template/Dummy/Resources/css/test.css', $additionalInformation['filepath']);
   }


    /**
     * setCssFileAcceptsUrl
     *
     * @test
     */
    public function setCssFileAcceptsUrl() {
        $this->view->addCssFile('http://elefunds.de/test.css');
        $this->assertSame($this->view->getCssFiles(), array('http://elefunds.de/test.css'));
    }
   
   /**
    * setJavascriptFilesCalculatesTheCorrectPathAndChecksForExistance
    *
    * @test
    */ 
   public function setJavascriptFilesCalculatesTheCorrectPathAndChecksForExistance() {
       
       $additionalInformation = array();       
       try {
           $this->view->addJavascriptFile('test.js');           
       } catch (ElefundsException $exception) {
           $additionalInformation = $exception->getAdditionalInformation();
       }
       
       $this->assertSame('Template/Dummy/Resources/js/test.js', $additionalInformation['filepath']);
   }

    /**
     * setJavascriptFilesAcceptsUrl
     *
     * @test
     */
    public function setJavascriptFilesAcceptsUrl() {
        $this->view->addJavascriptFile('http://elefunds.de/test.js');
        $this->assertSame($this->view->getJavascriptFiles(), array('http://elefunds.de/test.js'));
    }
   
   /**
    * assignSetsValueToTheView
    *
    * @test
    */
    public function assignSetsValueToTheView() {
        
        $foo = new stdClass();
        $foo->bar = 'baz';
        
        $this->view->assign('foo', $foo);
        
        $reflectionProperty = $this->reflectionClass->getProperty('view');
        $reflectionProperty->setAccessible(TRUE);
        $view = $reflectionProperty->getValue($this->view);
        $this->assertSame($foo->bar, $view['foo']->bar);
 
    }

    /**
     * assignMultipleAssignsMultipleValues
     *
     * @test
     */
    public function assignMultipleAssignsMultipleValues() {
        $this->view->assignMultiple(array(
                'foo'   =>  'bar',
                'baz'   =>  'boo'
        ));
        
        $reflectionProperty = $this->reflectionClass->getProperty('view');
        $reflectionProperty->setAccessible(TRUE);
        $view = $reflectionProperty->getValue($this->view);
        $this->assertSame('bar', $view['foo']);
        $this->assertSame('boo', $view['baz']);
    }
    
   /**
    * renderCalculatesTheCorrectPathToViewPhtmlAndChecksForExistance
    *
    * @test
    */ 
   public function renderCalculatesTheCorrectPathToViewPhtmlAndChecksForExistance() {
              
       try {
           $this->view->setRenderFile('Test.phtml');
           $this->view->render();
       } catch (ElefundsException $exception) {
           $additionalInformation = $exception->getAdditionalInformation();
       }
       
       $filepathExtractDoesMatch = strpos($additionalInformation['filepath'], 'Template/Dummy/Test.phtml') !== FALSE;
       $this->assertSame(TRUE, $filepathExtractDoesMatch);
           
   }

}
