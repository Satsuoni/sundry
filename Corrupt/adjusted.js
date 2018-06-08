(function(){
ips.templates.set('core.editor.quote', "<blockquote class='ipsQuote' ><div class='ipsQuote_citation'>{{citation}}</div><div class='ipsQuote_contents ipsClearfix'>{{{contents}}}</div></blockquote>");

 
comment_prototype = {
        _quoteData: null,
        _commentContents: '',
        _quotingDisabled: false,
        _inlineQuoteTimeout: null,
        _isEditing: false,
        _clickHandler: null,
        initialize: function() {
            this.on('click', '[data-action="editComment"]', this.editComment);
            this.on('click', '[data-action="cancelEditComment"]', this.cancelEditComment);
            this.on('click', '[data-action="deleteComment"]', this.deleteComment);
            this.on('click', '[data-action="approveComment"]', this.approveComment);
            this.on('click', '[data-action="quoteComment"]', this.quoteComment);
            this.on('click', '[data-action="multiQuoteComment"]', this.multiQuoteComment);
            this.on('click', '[data-action="rateReview"]', this.rateReview);
            this.on('submit', 'form', this.submitEdit);
            this.on('change', 'input[type="checkbox"][data-role="moderation"]', this.commentCheckbox);
            this.on('mouseup', '[data-role="commentContent"]', this.inlineQuote);
            this.on('click', '[data-action="quoteSelection"]', this.quoteSelection);
            this.on('menuOpened', '[data-role="shareComment"]', this.shareCommentMenu);
            this.on('setMultiQuoteEnabled.comment setMultiQuoteDisabled.comment', this.setMultiQuote);
            this.on('disableQuoting.comment', this.disableQuoting);
            this.on(document, 'getEditFormLoading.comment saveEditCommentLoading.comment ' + 'deleteCommentLoading.comment', this.commentLoading);
            this.on(document, 'getEditFormDone.comment saveEditCommentDone.comment ' + 'deleteCommentDone.comment', this.commentDone);
            this.on(document, 'getEditFormDone.comment', this.getEditFormDone);
            this.on(document, 'getEditFormError.comment', this.getEditFormDone);
            this.on(document, 'saveEditCommentDone.comment', this.saveEditCommentDone);
            this.on(document, 'saveEditCommentError.comment', this.saveEditCommentError);
            this.on(document, 'deleteCommentDone.comment', this.deleteCommentDone);
            this.on(document, 'deleteCommentError.comment', this.deleteCommentError);
            this.on(document, 'approveCommentLoading.comment', this.approveCommentLoading);
            this.on(document, 'approveCommentDone.comment', this.approveCommentDone);
            this.on(document, 'approveCommentError.comment', this.approveCommentError);
            this.setup();
        },
        setup: function() {
            this._commentID = this.scope.attr('data-commentID');
            this._clickHandler = _.bind(this._hideQuoteTooltip, this);
        },
        destroy: function() {},
        inlineQuote: function(e) {
            if (this._isEditing) {
                return;
            }
            var self = this;
            var selectedText = this._getSelectedText();
            var quoteButton = this.scope.find('[data-action="quoteComment"]');
            clearTimeout(this._inlineQuoteTimeout);
            if ($.trim(selectedText) === '' || this._quotingDisabled) {
                this._hideQuoteTooltip();
                return;
            }
            if (!quoteButton.length) {
                return;
            }
            this._getQuoteData();
            if (!selectedText.startsWith('<')) {
                selectedText = '<p>' + selectedText + '</p>';
            }
            this._selectedText = selectedText;
            this._inlineQuoteTimeout = setTimeout(function() {
                self._showQuoteTooltip(e.clientX, e.clientY);
            }, 300);
        },
        quoteSelection: function(e) {
            e.preventDefault();
            if (this._selectedText) {
                this.trigger('quoteComment.comment', {
                    userid: this._quoteData.userid,
                    username: this._quoteData.username,
                    timestamp: this._quoteData.timestamp,
                    contentapp: this._quoteData.contentapp,
                    contenttype: this._quoteData.contenttype,
                    contentclass: this._quoteData.contentclass,
                    contentid: this._quoteData.contentid,
                    contentcommentid: this._quoteData.contentcommentid,
                    quoteHtml: this._selectedText
                });
            }
            this._hideQuoteTooltip();
        },
        commentCheckbox: function(e) {
            var checked = $(e.currentTarget).is(':checked');
            this.scope.closest('.ipsComment').toggleClass('ipsComment_selected', checked);
            this.trigger('checkedComment.comment', {
                commentID: this._commentID,
                actions: $(e.currentTarget).attr('data-actions'),
                checked: checked
            });
        },
        disableQuoting: function() {
            this._quotingDisabled = true;
            this.scope.find('[data-ipsQuote-editor]').remove();
        },
        rateReview: function(e) {
            e.preventDefault();
            var scope = this.scope
            ips.getAjax()($(e.currentTarget).attr('href')).done(function(response) {
                scope.parent().replaceWith($(response));
            }).fail(function(err) {
                window.location = $(e.currentTarget).attr('href');
            });
        },
        shareCommentMenu: function(e, data) {
            if (data.menu) {
                data.menu.find('input[type="text"]').get(0).select();
            }
        },
        setMultiQuote: function(e, data) {
            var selector = '[data-commentApp="' + data.contentapp + '"]';
            selector += '[data-commentType="' + data.contenttype + '"]';
            selector += '[data-commentID="' + data.contentcommentid + '"]';
            if (this.scope.is(selector)) {
                if (!_.isNull(e) && e.type == 'setMultiQuoteEnabled') {
                    this.scope.find('[data-action="multiQuoteComment"]').removeClass('ipsButton_simple').addClass('ipsButton_alternate').attr('data-mqActive', true).html(ips.templates.render('core.posts.multiQuoteOn'));
                } else if (_.isNull(e) || e.type == 'setMultiQuoteDisabled') {
                    this.scope.find('[data-action="multiQuoteComment"]').addClass('ipsButton_simple').removeClass('ipsButton_alternate').removeAttr('data-mqActive').html(ips.templates.render('core.posts.multiQuoteOff'));
                }
            }
        },
        quoteComment: function(e) {
            e.preventDefault();
            if (!this._getQuoteData()) {
                Debug.error("Couldn't get quote data");
                return;
            }
            var html = this._prepareQuote($('<div/>').html(this.scope.find('[data-role="commentContent"]').html()));
            Debug.log(this._commentID);
            this.trigger('quoteComment.comment', {
                userid: this._quoteData.userid,
                username: this._quoteData.username,
                timestamp: this._quoteData.timestamp,
                contentapp: this._quoteData.contentapp,
                contenttype: this._quoteData.contenttype,
                contentclass: this._quoteData.contentclass,
                contentid: this._quoteData.contentid,
                contentcommentid: this._quoteData.contentcommentid,
                quoteHtml: html.html()
            });
        },
        multiQuoteComment: function(e) {
            e.preventDefault();
            if (!this._getQuoteData()) {
                Debug.error("Couldn't get quote data");
                return;
            }
            var button = $(e.currentTarget);
            var mqActive = button.attr('data-mqActive');
            var html = this._prepareQuote($('<div/>').html(this.scope.find('[data-role="commentContent"]').html()));
            this.trigger((mqActive) ? 'removeMultiQuote.comment' : 'addMultiQuote.comment', {
                userid: this._quoteData.userid,
                username: this._quoteData.username,
                timestamp: this._quoteData.timestamp,
                contentapp: this._quoteData.contentapp,
                contenttype: this._quoteData.contenttype,
                contentclass: this._quoteData.contentclass,
                contentid: this._quoteData.contentid,
                contentcommentid: this._quoteData.contentcommentid,
                quoteHtml: html.html(),
                button: button.attr('data-mqId')
            });
            if (mqActive) {
                button.removeClass('ipsButton_alternate').addClass('ipsButton_simple').removeAttr('data-mqActive').html(ips.templates.render('core.posts.multiQuoteOff'));
            } else {
                button.removeClass('ipsButton_simple').addClass('ipsButton_alternate').attr('data-mqActive', true).html(ips.templates.render('core.posts.multiQuoteOn'));
            }
        },
        editComment: function(e) {
            e.preventDefault();
            this._commentContents = this.scope.find('[data-role="commentContent"]').html();
            var url = $(e.currentTarget).attr('href');
            this.trigger('getEditForm.comment', {
                url: url,
                commentID: this._commentID
            });
        },
        cancelEditComment: function(e) {
            e.preventDefault();
            var self = this;
            ips.ui.alert.show({
                type: 'confirm',
                icon: 'warn',
                message: ips.getString('generic_confirm'),
                subText: '',
                callbacks: {
                    ok: function() {
                        self.scope.find('[data-role="commentContent"]').html(self._commentContents);
                        self.scope.find('[data-role="commentControls"], [data-action="expandTruncate"]').show();
                    }
                }
            });
        },
        submitEdit: function(e) {
            e.preventDefault();
            e.stopPropagation();
            var instance;
            var empty = false;
            for (instance in CKEDITOR.instances) {
                CKEDITOR.instances[instance].updateElement();
            }
            if (typeof CKEDITOR.instances['comment_value'] !== 'undefined') {
                var postBody = $.trim(CKEDITOR.instances['comment_value'].editable().getData().replace(/&nbsp;/g, ''));
                if (postBody == '' || postBody.match(/^<p>(<p>|<\/p>|\s)*<\/p>$/)) {
                    ips.ui.alert.show({
                        type: 'alert',
                        icon: 'warn',
                        message: ips.getString('cantEmptyEdit'),
                        subText: ips.getString('cantEmptyEditDesc')
                    });
                    return;
                }
            }
            var form = this.scope.find('form');
            var url = form.attr('action');
            var data = form.serialize();
            form.find('[data-action="cancelEditComment"]').remove();
            form.find('[type="submit"]').prop('disabled', true).text(ips.getString('saving'));
            this.trigger('saveEditComment.comment', {
                form: data,
                url: url,
                commentID: this._commentID
            });
        },
        commentLoading: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            var commentLoading = this.scope.find('[data-role="commentLoading"]');
            commentLoading.removeClass('ipsHide').find('.ipsLoading').removeClass('ipsLoading_noAnim');
            ips.utils.anim.go('fadeIn', commentLoading);
        },
        commentDone: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            this.scope.find('[data-role="commentLoading"]').addClass('ipsHide').find('.ipsLoading').addClass('ipsLoading_noAnim');
        },
        getEditFormDone: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            var self = this;
            var showForm = function() {
                self._isEditing = true;
                self.scope.find('[data-action="expandTruncate"], [data-role="commentControls"]').hide();
                self.scope.find('[data-role="commentContent"]').html(data.response);
                $(document).trigger('contentChange', [self.scope.find('[data-role="commentContent"]')]);
            };
            var elemPosition = ips.utils.position.getElemPosition(this.scope);
            var windowScroll = $(window).scrollTop();
            var viewHeight = $(window).height();
            if (elemPosition.absPos.top < windowScroll || elemPosition.absPos.top > (windowScroll + viewHeight)) {
                $('html, body').animate({
                    scrollTop: elemPosition.absPos.top + 'px'
                }, function() {
                    showForm();
                });
            } else {
                showForm();
            }
        },
        getEditFormError: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            window.location = data.url;
        },
        saveEditCommentDone: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            this._isEditing = false;
            this.scope.find('[data-role="commentContent"]').replaceWith($('<div>' + data.response + '</div>').find('[data-role="commentContent"]'));
            this.scope.trigger('initializeImages');
            this.scope.find('[data-action="expandTruncate"], [data-role="commentControls"]').show();
            $(document).trigger('contentChange', [this.scope]);
        },
        saveEditCommentError: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            ips.ui.alert.show({
                type: 'alert',
                icon: 'warn',
                message: ips.getString('editCommentError'),
            });
        },
        approveComment: function(e) {
            e.preventDefault();
            var url = $(e.currentTarget).attr('href');
            this.trigger('approveComment.comment', {
                url: url,
                commentID: this._commentID
            });
        },
        approveCommentLoading: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            this.scope.find('[data-role="commentControls"]').addClass('ipsFaded').find('[data-action="approveComment"]').addClass('ipsButton_disabled').text(ips.getString('commentApproving'));
        },
        approveCommentDone: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            var commentHtml = $('<div>' + data.response + '</div>').find('[data-controller="core.front.core.comment"]').html();
            this.scope.html(commentHtml).removeClass('ipsModerated').closest('.ipsComment').removeClass('ipsModerated');
            $(document).trigger('contentChange', [this.scope]);
            if (ips.utils.db.isEnabled()) {
                this.scope.find('[data-action="multiQuoteComment"]').removeClass('ipsHide');
            }
            ips.ui.flashMsg.show(ips.getString('commentApproved'));
        },
        approveCommentError: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            window.location = data.url;
        },
        deleteComment: function(e) {
            e.preventDefault();
            var self = this;
            var url = $(e.currentTarget).attr('href');
            var commentData = this._getQuoteData();
            var eventData = _.extend(commentData, {
                url: url,
                commentID: this._commentID
            });
            ips.ui.alert.show({
                type: 'confirm',
                icon: 'warn',
                message: ips.getString('delete_confirm'),
                callbacks: {
                    ok: function() {
                        self.trigger('deleteComment.comment', eventData);
                    }
                }
            });
        },
        deleteCommentDone: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            var deleteLink = this.scope.find('[data-action="deleteComment"]');
            var toHide = null;
            var toShow = null;
            if (deleteLink.attr('data-hideOnDelete')) {
                toHide = this.scope.find(deleteLink.attr('data-hideOnDelete'));
            } else {
                toHide = this.scope.closest('article');
            }
            toHide.animationComplete(function() {
                toHide.remove();
            });
            ips.utils.anim.go('fadeOutDown', toHide);
            if (deleteLink.attr('data-updateOnDelete')) {
                $(deleteLink.attr('data-updateOnDelete')).text(parseInt($(deleteLink.attr('data-updateOnDelete')).text()) - 1);
            }
            if (deleteLink.attr('data-showOnDelete')) {
                toShow = this.scope.find(deleteLink.attr('data-showOnDelete'));
                ips.utils.anim.go('fadeIn', toShow);
            }
            this.trigger('deletedComment.comment', {
                commentID: this._commentID,
                response: data.response
            });
        },
        deleteCommentError: function(e, data) {
            if (data.commentID != this._commentID) {
                return;
            }
            window.location = data.url;
        },
        _prepareQuote: function(html) {
           /* if (html.find('blockquote.ipsQuote') && html.find('blockquote.ipsQuote').parent() && html.find('blockquote.ipsQuote').parent().get(0) && html.find('blockquote.ipsQuote').parent().get(0).tagName == 'DIV' && html.find('blockquote.ipsQuote').siblings().length == 0) {
                var div = html.find('blockquote.ipsQuote').closest('div');
                div.next('p').find("br:first-child").remove();
                div.remove();
            } else {
                html.find('blockquote.ipsQuote').remove();
            }*/
            html.find('.ipsStyle_spoilerFancy,.ipsStyle_spoiler').replaceWith(ips.templates.render('core.posts.quotedSpoiler'));
            html.find("[data-excludequote]").remove();
            //html.find('.ipsQuote_citation').remove();
            html.find('[data-quote-value]').each(function() {
                $(this).replaceWith('<p>' + $(this).attr('data-quote-value') + '</p>');
            });
            return html;
        },
        _getQuoteData: function() {
            if (!this._quoteData) {
                try {
                    this._quoteData = $.parseJSON(this.scope.attr('data-quoteData'));
                    return this._quoteData;
                } catch (err) {
                    Debug.log("Couldn't parse quote data");
                    return {};
                }
            }
            return this._quoteData;
        },
        _getSelectedText: function() {
            var text = '';
            var container = this.scope.find('[data-role="commentContent"]').get(0);
            var isChild = function(child, parent) {
                if (child === parent) {
                    return true;
                }
                var current = child;
                while (current) {
                    if (current === parent) {
                        return true;
                    }
                    current = current.parentNode;
                }
                return false;
            };
            if (window.getSelection || document.getSelection) {
                var selection = (window.getSelection) ? window.getSelection() : document.getSelection();
                if (selection.rangeCount > 0) {
                    var range = selection.getRangeAt(0);
                    var clonedSelection = range.cloneContents().querySelector('[data-role="commentContent"]');
                    if (clonedSelection) {
                        text = clonedSelection.innerHTML;
                    } else {
                        clonedSelection = range.cloneContents();
                        var startNode = selection.getRangeAt(0).startContainer.parentNode;
                        if (isChild(startNode, container)) {
                            var div = document.createElement('div');
                            div.appendChild(clonedSelection);
                            text = div.innerHTML;
                        }
                    }
                    return text;
                }
            } else if (document.selection) {
                return document.selection.createRange().htmlText;
            }
            return '';
        },
        _showQuoteTooltip: function(clientX, clientY) {
            var tooltip = this.scope.find('[data-role="inlineQuoteTooltip"]');
            if (!tooltip.length) {
                this.scope.append(ips.templates.render('core.selection.quote'));
                tooltip = this.scope.find('[data-role="inlineQuoteTooltip"]');
            }
            var scopeOffset = this.scope.offset();
            var lineHeight = ips.utils.position.lineHeight(this.scope.find('[data-role="commentContent"]'));
            var documentScroll = {
                top: $(document).scrollTop(),
                left: $(document).scrollLeft()
            };
            var tooltipSize = {
                width: tooltip.show().width(),
                height: tooltip.show().height()
            };
            var tooltipPos = {
                left: (clientX + documentScroll.left) - scopeOffset.left - (tooltipSize.width / 2),
                top: (clientY + documentScroll.top) - scopeOffset.top - tooltipSize.height - lineHeight
            };
            this.scope.find('[data-role="inlineQuoteTooltip"]').css({
                position: 'absolute',
                left: tooltipPos.left + "px",
                top: tooltipPos.top + "px",
            }).hide().fadeIn('fast');
            $(document).on('click', this._clickHandler);
        },
        _hideQuoteTooltip: function() {
            $(document).off('click', this._clickHandler);
            this.scope.find('[data-role="inlineQuoteTooltip"]').fadeOut('fast');
            clearTimeout(this._inlineQuoteTimeout);
        }
    }
    
ips.controller.register('core.front.core.truecomment', comment_prototype);
$('[data-_controllerObjs!=""]').each(function(){ cons= $(this).data('_controllerObjs'); 
 if(cons){
  var trep=false;
  for (i in cons) {
      if(cons[i].controllerType=="core.front.core.comment")
      {
      // console.log(cons[i]._eventListeners);
      trep=true;
       for (evl in cons[i]._eventListeners)
        {
        if(cons[i]._eventListeners[evl].delegate=='[data-action="quoteComment"]')
         cons[i]._eventListeners[evl].elem.off(cons[i]._eventListeners[evl].event,cons[i]._eventListeners[evl].delegate);
         //cons[i].on('click', '[data-action="quoteComment"]',trueFuncs.quoteComment);
        }
     }
     }
  if(trep)
   {
   ips.controller.initControllerOnElem(this,'core.front.core.truecomment',[]);
   }
  };
  });
  
( function() {
function getRange( editor ) {
		// Get the selection ranges.
		var ranges = editor.getSelection().getRanges( true );

		// Delete the contents of all ranges except the first one.
		for ( var i = ranges.length - 1; i > 0; i-- ) {
			ranges[ i ].deleteContents();
		}

		// Return the first range.
		return ranges[ 0 ];
	}
    function replaceRangeWithClosestEditableRoot( range ) {
		var closestEditable = range.startContainer.getAscendant( function( node ) {
			return node.type == CKEDITOR.NODE_ELEMENT && node.getAttribute( 'contenteditable' ) == 'true';
		}, true );

		if ( range.root.equals( closestEditable ) ) {
			return range;
		} else {
			var newRange = new CKEDITOR.dom.range( closestEditable );

			newRange.moveToRange( range );
			return newRange;
		}
	}
    CKEDITOR.plugins.add( 'breaker', {
        init: function( editor ) {
         editor.addCommand( 'cycleenter', {
                exec: function( editor ) {
                    //console.log(editor);
                    editor.fire( 'saveSnapshot' );
                    if(_.isUndefined(editor.activeEnterMode))
                    {
                    editor.activeEnterMode=CKEDITOR.ENTER_BR;
                    return;
                    }
                    if(editor.activeEnterMode == CKEDITOR.ENTER_BR)
                    {
                    editor.activeEnterMode=CKEDITOR.ENTER_DIV;
                    return;
                    }
                     if(editor.activeEnterMode == CKEDITOR.ENTER_DIV)
                    {
                    editor.activeEnterMode=CKEDITOR.ENTER_P;
                    return;
                    }
                     if(editor.activeEnterMode == CKEDITOR.ENTER_P)
                    {
                    editor.activeEnterMode=CKEDITOR.ENTER_BR;
                    return;
                    }
                    editor.fire( 'saveSnapshot' );                    
              
                }
                });
            editor.addCommand( 'quotebreak', {
                exec: function( editor ) {
                    //console.log(editor);
                    if ( editor.mode != 'wysiwyg' )
                        return;  
                    mode = editor.activeEnterMode;    
                    var path = editor.elementPath();
                    editor.fire( 'saveSnapshot' );
                    this.enterBlock( editor, mode, null, false );
                    editor.fire( 'saveSnapshot' );                    
                   // var format = { element: 'h1' };
                   // var style = new CKEDITOR.style(format);
                   // style.apply(editor.document);
                },
                enterBlock: function( editor, mode, range, forceMode ) {
                
            range = range || getRange( editor );
            if ( !range )
                return;
                console.log("range");
                console.log(range);
            range = replaceRangeWithClosestEditableRoot( range );
           
                console.log("post");
            console.log(range);
            var doc = range.document;
            var atBlockStart = range.checkStartOfBlock(),
                atBlockEnd = range.checkEndOfBlock(),
                path = editor.elementPath( range.startContainer ),
                block = path.block;
                 console.log( path);
               console.log( atBlockStart);
               if(!block)
               {
               if(!atBlockStart&&!atBlockEnd)
               {
               block=range.startContainer;}
               else
               return;
               }
               
                console.log(block.getParent());
                //range.splitBlock( "div" );
                par= block;
                while(par && !par.hasClass("ipsQuote_contents"))
              {
              //console.log(par);
              par=par.getParent();
              }
              if(! par) {
              console.log("Not in quote");
              return;
              }
               dat=this.splitBlock(range);
                if(!dat.previousBlock)
                {
                dat.previousBlock=block.getPrevious();
                }
               var doc = range.document;
                newBlock = doc.createElement( 'div' );
                newbr=doc.createElement("br");
                newbr.move(newBlock,1);
                citation=par.getPrevious().clone(true);//doc.createElement( 'div' );
                //citation.addClass("ipsQuote_citation");
                newBlock.insertAfter( dat.previousBlock );
                
                var grand=par.getParent().getParent();
                //console.log(grandId);
                this.breakParent2(newBlock,par.getParent() );
                //console.log("grand");
                //widgets!!
                editor.widgets.initOn( par.getParent(), 'ipsquote' )
                
               // newBlock.getNext().setAttribute("data-cke-widget-id",grandId+1);
                var nblk=newBlock.getNext();
                citation.move( nblk, 1 );
                 newBlock.remove();
                 newBlock.insertAfter(grand);
                 nblk.remove();
                 nblk.insertAfter(newBlock);
                 nblk.setAttribute("data-cke-widget-upcasted",0)
                 editor.widgets.initOn( nblk, 'ipsquote' );
                editor.widgets.checkWidgets();
                
             var range = editor.createRange();
             range.moveToElementEditStart(newBlock);
             range.collapse(true);
             editor.getSelection().selectRanges( [ range ] );

              //this.breakParent2(dat.nextBlock,par);
              
             
              
              
               
        },
        splitBlock: function( that, cloneId ) {
var startPath = new CKEDITOR.dom.elementPath( that.startContainer, that.root ),
endPath = new CKEDITOR.dom.elementPath( that.endContainer, that.root );
var startBlockLimit = startPath.blockLimit,
endBlockLimit = endPath.blockLimit;
var startBlock = startPath.block,
endBlock = endPath.block;
if(!startBlock)
    {
    startBlock=that.startContainer;
    }
    if(!endBlock)
    {
    endBlock=that.endContainer;
    }
var elementPath = null;
// Do nothing if the boundaries are in different block limits.
console.log("blim");
if ( !startBlockLimit.equals( endBlockLimit ) )
return null;
// Get or fix current blocks.
console.log("alim");
// Get the range position.
var isStartOfBlock = startBlock && that.checkStartOfBlock(),
isEndOfBlock = endBlock && that.checkEndOfBlock();
// Delete the current contents.
// TODO: Why is 2.x doing CheckIsEmpty()?
that.deleteContents();
//console.log(startBlock);
//console.log(endBlock);
if ( startBlock && startBlock.equals( endBlock ) ) {
if ( isEndOfBlock ) {
console.log("end");
elementPath = new CKEDITOR.dom.elementPath( that.startContainer, that.root );
that.moveToPosition( endBlock, CKEDITOR.POSITION_AFTER_END );
endBlock = null;
} else if ( isStartOfBlock ) {
console.log("start");
elementPath = new CKEDITOR.dom.elementPath( that.startContainer, that.root );
that.moveToPosition( startBlock, CKEDITOR.POSITION_BEFORE_START );
startBlock = null;
} else {
console.log("middle");
endBlock = that.splitElement( startBlock, cloneId || false );

// In Gecko, the last child node must be a bogus <br>.
// Note: bogus <br> added under <ul> or <ol> would cause
// lists to be incorrectly rendered.
if ( !startBlock.is( 'ul', 'ol' ) )
startBlock.appendBogus();
}
}
return {
previousBlock: startBlock,
nextBlock: endBlock,
wasStartOfBlock: isStartOfBlock,
wasEndOfBlock: isEndOfBlock,
elementPath: elementPath
};
},
         breakParent2: function(that, parent, cloneId ) {
            var range = new CKEDITOR.dom.range( that.getDocument() );
            console.log(range);
            // We'll be extracting part of this element, so let's use our
            // range to get the correct piece.
            range.setStartAfter( that );
            range.setEndAfter( parent );
            // Extract it.
            var docFrag = range.extractContents( false, cloneId || false );
            // Move the element outside the broken element.
            range.insertNode( that.remove() );
            // Re-insert the extracted piece after the element.
            docFrag.insertAfterNode( that );
            }
            
            } );
           
           editor.addCommand( 'savedata', {
                exec: function( editor ) {
                    //console.log(editor);
                    editor.fire( 'saveSnapshot' );
                    ips.utils.db.set("editorSave","adjusted",editor.getData());
                    editor.fire( 'saveSnapshot' );                    
              
                }
                });
                 editor.addCommand( 'loaddata', {
                exec: function( editor ) {
                    //console.log(editor);
                    editor.fire( 'saveSnapshot' );
                     var c=ips.utils.db.get("editorSave","adjusted");
                     console.log(c);
                     editor.setData(c);
                    editor.fire( 'saveSnapshot' );                    
              
                }
                });
          
            editor.setKeystroke( CKEDITOR.CTRL + 13 , 'quotebreak' ); // ALT + 1
 editor.setKeystroke( CKEDITOR.CTRL +CKEDITOR.SHIFT+ 13 , 'cycleenter' ); //s -83 l -76
 editor.setKeystroke( CKEDITOR.CTRL + 83 , 'savedata' );
  editor.setKeystroke( CKEDITOR.CTRL + 76 , 'loaddata' );
        },
        

       
    });
} )();


(function($, _, undefined) {
    "use strict";
    ips.createModule('ips.ui.editor', function() {
        var defaults = {
            allbuttons: false,
            postKey: '',
            toolbars: '',
            emoticons: '',
            extraPlugins: '',
            contentsCss: '',
            minimized: false,
            autoSaveKey: null,
            skin: 'ips',
            autoGrow: true,
            pasteBehaviour: 'rich',
            autoEmbed: false,
            controller: null,
           
        };
        var respond = function(elem, options) {
                var loadTries = 0;
                if (ips.getSetting('useCompiledFiles') !== true) {
                    ips.loader.get(['core/dev/ckeditor/ckeditor.js']).then(bootEditor);
                } else {
                    ips.loader.get(['core/interface/ckeditor/ckeditor/ckeditor.js']).then(bootEditor);
                }

                function bootEditor() {
                    if ((!CKEDITOR || _.isUndefined(CKEDITOR.on)) && loadTries < 60) {
                        loadTries++;
                        setTimeout(bootEditor, 50);
                        return;
                    }
                    if (CKEDITOR.status == 'loaded') {
                        ckLoaded();
                    } else {
                        CKEDITOR.on('loaded', function() {
                            ckLoaded();
                        });
                    }
                };

                function ckLoaded() {
                   if (!$(elem).data('_editor')) 
                    {
                        var editor = editorObj(elem, _.defaults(options, defaults));
                        $(elem).data('_editor', editor);
                        editor.init();
                    }
                    
                };
            },
            destruct = function(elem) {
                var obj = getObj(elem);
                if (!_.isUndefined(obj)) {
                    obj.destruct();
                }
            },
            getObj = function(elem) {
                if ($(elem).data('_editor')) {
                    return $(elem).data('_editor');
                }
                return undefined;
            };
        ips.ui.registerWidget('editor', ips.ui.editor, ['allbuttons', 'postKey', 'toolbars', 'extraPlugins', 'autoGrow', 'contentsCss', 'minimized', 'autoSaveKey', 'skin', 'name', 'emoticons', 'pasteBehaviour', 'autoEmbed', 'controller']);
        return {
            respond: respond,
            getObj: getObj,
            destruct: destruct
        };
    });
    var editorObj = function(elem, options) {
        var instance = null;
        var hiddenAtStart = false;
        var minimized = options.minimized;
        var hiddenInterval = null;
        var size = 'phone';
        var name = '';
        var previewIframe = null;
        var currentPreviewView = '';
        var previewInitialHeight = 0;
        var previewSizes = {
            phone: 375,
            tablet: 780
        };
        var init = function(callback) {
            var config = {
                allowedContent: true,
                extraAllowedContent : 'p(*)[*]{*};div(*)[*]{*};li(*)[*]{*};ul(*)[*]{*}',
                contentsLangDirection: $('html').attr('dir'),
                disableNativeSpellChecker: false,
                extraPlugins: 'breaker,ipsautolink,ipsautosave,ipscode,ipscontextmenu,ipsimage,ipslink,ipsmentions,ipspage,ipspaste,ipspreview,ipsquote,ipsspoiler,ipsautogrow,removeformat',
                ipsAutoSaveKey: options.autoSaveKey,
                ipsPasteBehaviour: options.pasteBehaviour,
                pasteFilter: options.pasteBehaviour == 'force' ? 'plain-text' : null,
                ipsAutoEmbed: false,
                removeButtons: '',
                skin: options.skin,
                height: 'auto',
                title: window.navigator.platform == 'MacIntel' ? ips.getString('editorRightClickMac') : ips.getString('editorRightClick'),
                controller: options.controller
            };
            CKEDITOR.config.enterMode = CKEDITOR.ENTER_BR;
            CKEDITOR.config.autoParagraph = false;
            CKEDITOR.config.allowedContent = true;
            CKEDITOR.config.fillEmptyBlocks =false;
            CKEDITOR.config.basicEntities = true;
            CKEDITOR.config.extraAllowedContent = 'p(*)[*]{*};div(*)[*]{*};li(*)[*]{*};ul(*)[*]{*}';
            CKEDITOR.dtd.$removeEmpty["b"]=false;
            CKEDITOR.dtd.$removeEmpty["i"]=false;
            if (!/iPad|iPhone|iPod/.test(navigator.platform)) {
                config.removePlugins = 'elementspath';
            }
            name = $(elem).find('textarea').attr('name');
            $(elem).trigger('editorCompatibility', {
                compatible: CKEDITOR.env.isCompatible
            });
            if (options.minimized && minimized) {
                $(elem).find('.ipsComposeArea_dummy').show().on('focus click', function() {
                    setTimeout(function() {
                        unminimize(function() {
                            focus();
                        });
                    }, 200);
                }).end().find('[data-role="mainEditorArea"]').hide().end().closest('.ipsComposeArea').find('[data-ipsEditor-toolList]').hide();
                $(document).on('initializeEditor', _initializeEditor);
                minimized = true;
            }
            if (!elem.is(':visible')) {
                hiddenAtStart = true;
                if (!options.minimized && !minimized) {
                    clearInterval(hiddenInterval);
                    hiddenInterval = setInterval(function() {
                        if (elem.is(':visible')) {
                            clearInterval(hiddenInterval);
                            resize(true);
                            hiddenAtStart = false;
                        }
                    }, 400);
                }
            }
            var language = $('html').attr('lang').toLowerCase();
            if (!CKEDITOR.lang.languages[language]) {
                var language = language.substr(0, 2);
                if (CKEDITOR.lang.languages[language]) {
                    config.language = language;
                }
            } else {
                config.language = language;
            }
            
            if (options.extraPlugins !== true) {
                config.extraPlugins += ',' + options.extraPlugins;
            }
            instance = CKEDITOR.replace($(elem).find('textarea').get(0), config);
            instance.once('instanceReady', function() {
                elem.trigger('editorWidgetInitialized', {
                    id: name
                });
                if (_.isFunction(callback)) {
                    callback();
                }
            });
            if (!options.allbuttons) {
                $(window).on('resize', resize);
            }
            $(document).on('fileDeleted', _deleteFile);
           // $(document).on('insertEmoticon', _insertEmoticon);
            $(elem).on('togglePreview', _togglePreview);
            $(window).on('message', _previewMessage);
            $(elem).closest('form').on('submit', function(e) {
                ips.utils.db.remove('editorSave', options.autoSaveKey);
            });
        };
        var destruct = function() {
            try {
                instance.destroy();
                $(window).off('resize', resize);
                $(document).off('fileDeleted', _deleteFile);
                $(document).off('initializeEditor', _initializeEditor);
               // $(document).off('insertEmoticon', _insertEmoticon);
                $(window).off('message', _previewMessage);
            } catch (err) {
                Debug.error(err);
            }
        };
        var resize = function(focus) {
            var width = elem.width();
            var newSize = 'phone';
            if (width > 700) {
                newSize = 'desktop';
            } else if (width > 400) {
                newSize = 'tablet';
            }
            if (newSize != size) {
                size = newSize;
                instance.destroy();
                init(function() {
                    if (focus) {
                        instance.focus();
                    }
                });
            }
        };
        var focus = function() {
            instance.focus();
        };
        var unminimize = function(callback) {
            if (!_.isFunction(callback)) {
                callback = $.noop;
            }
            if (minimized) {
                $(elem).find('.ipsComposeArea_dummy').hide().end().find('[data-role="mainEditorArea"]').show().end().closest('.ipsComposeArea').find('[data-ipsEditor-toolList]').show();
                if (instance.status == 'ready') {
                    minimized = false;
                    callback();
                    if (hiddenAtStart) {
                        resize(true);
                        hiddenAtStart = false;
                    }
                } else {
                    instance.once('instanceReady', function() {
                        minimized = false;
                        callback();
                        if (hiddenAtStart) {
                            resize(true);
                            hiddenAtStart = false;
                        }
                    });
                }
                var minimizedUploader = $(elem).find('[data-ipsEditor-toolListMinimized]');
                if (minimizedUploader.length) {
                    minimizedUploader.show();
                    ips.getAjax()(elem.parentsUntil('', 'form').attr('action'), {
                        'data': {
                            'getUploader': minimizedUploader.attr('data-name')
                        }
                    }).done(function(response) {
                        minimizedUploader.replaceWith(response);
                        $(document).trigger('contentChange', [elem]);
                    });
                }
            } else {
                callback();
            }
        };
        var insertQuotes = function(quotes) {
            unminimize(function() {
                var ranges = instance.getSelection().getRanges();
               // console.log(JSON.stringify(quotes));
               var bp = new CKEDITOR.dom.element('div');
                        (new CKEDITOR.dom.element('br')).appendTo(bp);
                        instance.insertElement(bp);
                        
                for (var i = 0; i < ranges.length; i++) {
                    var previousNode = ranges[i].getCommonAncestor(true, true).getPrevious();
                    if (previousNode && previousNode.hasClass('cke_widget_wrapper')) {
                        var blankParagraph = new CKEDITOR.dom.element('p');
                        (new CKEDITOR.dom.element('br')).appendTo(blankParagraph);
                        instance.insertElement(blankParagraph);
                    }
                }
                for (var i = 0; i < quotes.length; i++) {
                    var data = quotes[i];
                    var quote = $(ips.templates.render('core.editor.quote', {
                        citation: ips.utils.getCitation(data),
                        contents: data.quoteHtml.trim()
                    }));
                    var attrs = ['timestamp', 'username'];
                    var j = 0;
                    for (j in attrs) {
                        if (data[attrs[j]]) {
                            quote.attr('data-ipsQuote-' + attrs[j], data[attrs[j]]);
                        }
                    }
                    var element = CKEDITOR.dom.element.createFromHtml($('<div>').append(quote).html());
                    instance.insertElement(element);
                    instance.widgets.initOn(element, 'ipsquote');
//                    if (i + 1 < quotes.length)
                    {
                        var blankParagraph = new CKEDITOR.dom.element('div');
                        (new CKEDITOR.dom.element('br')).appendTo(blankParagraph);
                        instance.insertElement(blankParagraph);
                    }
                }
            });
        };
        var updateImage = function(width, height, align, url) {
            var selection = instance.getSelection();
            var selectedElement = $(selection.getSelectedElement().$);
            if (url) {
                if (!url.match(/^[a-z]+\:\/\//i)) {
                    url = 'http://' + url;
                }
                if (selectedElement.parent().prop('tagName') === 'A') {
                    selectedElement.parent().attr('href', url).removeAttr('data-cke-saved-href');
                } else {
                    selectedElement.wrap($('<a>').attr('href', url));
                }
            } else {
                if (selectedElement.parent().prop('tagName') === 'A') {
                    selectedElement.parent().replaceWith(selectedElement);
                }
            }
            selectedElement.css({
                "width": width,
                "height": height
            });
            if (align) {
                if (selectedElement.parent().prop('tagName') === 'A') {
                    selectedElement.parent().css('float', align).addClass('ipsAttachLink ipsAttachLink_' + align);
                } else {
                    selectedElement.css('float', align).addClass('ipsAttachLink_image ipsAttachLink_' + align);
                }
            } else {
                selectedElement.css('float', '').removeClass('ipsAttachLink_left').removeClass('ipsAttachLink_right');
                if (selectedElement.parent().prop('tagName') === 'A') {
                    selectedElement.parent().css('float', '').removeClass('ipsAttachLink_left').removeClass('ipsAttachLink_right');
                }
            }
        };
        var insertHtml = function(html) {
            instance.insertHtml(html);
        };
        var reset = function() {
            instance.setData('<p></p>');
            elem.find('[data-ipsUploader]').trigger('resetUploader');
        };
        var saveAndClearAutosave = function() {
            instance.updateElement();
            ips.utils.db.remove('editorSave', options.autoSaveKey);
        };
        var _belongsToThisEditor = function(data) {
            if (_.isUndefined(data.editorID) || data.editorID !== name) {
                return false;
            }
            return true;
        };
        var _initializeEditor = function(e, data) {
            if (!_belongsToThisEditor(data)) {
                return;
            }
            unminimize(function() {
                _scrollToEditor();
                focus();
            });
        };
        var _deleteFile = function(e, data) {
            var links = instance.document.getElementsByTag('a');
            for (var i = 0; i < links.count(); ++i) {
                var link = links.getItem(i);
                if (link.$.getAttribute('data-fileid') == data.fileElem.attr('data-fileid') || link.$.getAttribute('href') == ips.getSetting('baseURL') + 'applications/core/interface/file/attachment.php?id=' + data.fileElem.attr('data-fileid')) {
                    link.remove();
                }
            }
            var images = instance.document.getElementsByTag('img');
            var toRemove = [];
            for (var i = 0; i < images.count(); ++i) {
                var image = images.getItem(i);
                if (image.$.getAttribute('data-fileid') == data.fileElem.attr('data-fileid')) {
                    toRemove.push(image);
                }
            }
            for (var i = 0; i < toRemove.length; i++) {
                toRemove[i].remove();
            }
        };
        var _scrollToEditor = function() {
            var elemPosition = ips.utils.position.getElemPosition(elem);
            var windowScroll = $(window).scrollTop();
            var viewHeight = $(window).height();
            if (elemPosition.absPos.top < windowScroll || elemPosition.absPos.top > (windowScroll + viewHeight)) {
                $('html, body').animate({
                    scrollTop: elemPosition.absPos.top + 'px'
                });
            }
        };
        var _insertEmoticon = function(e, data) {
            try {
                if (_belongsToThisEditor(data)) {
                    var imgTag = '<img src="' + data.src + '" title="' + data.text + '" alt="' + data.text + '"';
                    if (data.srcset) {
                        imgTag += ' srcset="' + data.srcset + '"';
                    }
                    if (data.width && data.height) {
                        imgTag += ' width="' + data.width + '" height="' + data.height + '"';
                    }
                    imgTag += ' data-emoticon="true">';
                    insertHtml(imgTag);
                    focus();
                }
            } catch (err) {
                Debug.error("CKEditor instance couldn't be fetched");
                return;
            }
        };
        var _togglePreview = function() {
            if (elem.find('[data-role="previewFrame"]').length) {
              if(previewIframe==null)
               _buildAndShowPreview();
               else
                _showPreview();
            } else {
                _buildAndShowPreview();
            }
        };
        var _showPreview = function() {
            var currentHeight = elem.height();
            elem.find('[data-role="editorComposer"]').hide();
            elem.find('[data-role="editorPreview"]').show();
            var toolbarHeight = elem.find('[data-role="previewToolbar"]').height();
            elem.find('[data-role="previewFrame"]').css({
                height: (currentHeight - toolbarHeight) + 'px'
            });
            _fetchPreview();
        };
        var _buildAndShowPreview = function() {
            var currentHeight = elem.height();
            var iframe = $('<iframe />').addClass('ipsAreaBackground_reset').css({
                border: 0,
                width: '100%'
            }).prop('seamless', true).attr('src', ips.getSetting('baseURL') + 'index.php?app=core&module=system&controller=editor&do=preview&editor_id=' + name).attr('data-role', 'previewFrame');
            currentPreviewView = ips.utils.responsive.getCurrentKey();
            _showPreviewButtons(currentPreviewView);
            elem.on('click', 'a[data-action="closePreview"]', _closePreview);
            elem.on('click', '[data-action="resizePreview"] a', _resizePreview);
            elem.find('[data-role="editorComposer"]').hide();
            elem.find('[data-role="editorPreview"]').show();
            var toolbarHeight = elem.find('[data-role="previewToolbar"]').height();
            previewInitialHeight = currentHeight - toolbarHeight;
            elem.find('[data-role="previewContainer"]').append(iframe.css({
                height: previewInitialHeight + 'px'
            }));
            previewIframe = iframe.get(0).contentWindow;
        };
        var _showPreviewButtons = function(currentView) {
            var toolbar = elem.find('[data-role="previewToolbar"]');
            if (ips.utils.responsive.getCurrentKey() == 'phone' || size == 'phone') {
                toolbar.find('[data-size]').hide();
                return;
            }
            toolbar.find('[data-size]').show().filter('[data-size="' + currentView + '"]').find('a').removeClass('ipsButton_light').addClass('ipsButton_primary');
            if (ips.utils.responsive.getCurrentKey() == 'tablet' || size == 'tablet') {
                toolbar.find('[data-size="desktop"]').hide();
            }
        };
        var _resizePreview = function(e) {
            e.preventDefault();
            var newKey = $(e.target).closest('[data-size]').attr('data-size');
            if (newKey == currentPreviewView) {
                return;
            }
            var toolbar = elem.find('[data-role="previewToolbar"]');
            toolbar.find('[data-size] a').removeClass('ipsButton_primary').addClass('ipsButton_light');
            toolbar.find('[data-size="' + newKey + '"] a').addClass('ipsButton_primary').removeClass('ipsButton_light');
            currentPreviewView = newKey;
            elem.find('[data-role="previewFrame"]').css({
                height: previewInitialHeight + 'px'
            });
            if (newKey == size) {
                elem.find('[data-role="previewFrame"]').removeClass('ipsComposeArea_smallPreview').css({
                    margin: '0px',
                    maxWidth: '100%',
                    width: '100%'
                });
            } else {
                elem.find('[data-role="previewFrame"]').addClass('ipsComposeArea_smallPreview').css({
                    marginTop: '10px',
                    marginBottom: '10px',
                    maxWidth: previewSizes[newKey] + 'px',
                    width: '100%'
                });
            }
        };
        var _previewMessage = function(e, data) {
            var oE = e.originalEvent;
            var json = $.parseJSON(oE.data);
            if (oE.origin !== ips.utils.url.getOrigin()) {
                return;
            }
            if (_.isUndefined(json.editorID) || json.editorID !== name || _.isUndefined(json.message)) {
                return;
            }
            switch (json.message) {
                case 'iframeReady':
                    //console.log(e.originalEvent);
                    _fetchPreview();
                    break;
                case 'previewHeight':
                    _setPreviewHeight(json);
                    break;
            }
        };
        var _fetchPreview = function() {
            _sendMessage({
                message: 'fetchPreview',
                editorContent: instance.getData(),
                url: elem.closest('form').attr('action')
            });
        };
        var _closePreview = function(e) {
            e.preventDefault();
            elem.find('[data-role="editorPreview"]').hide();
            elem.find('[data-role="editorComposer"]').show();
            _sendMessage({
                message: 'previewClosed'
            });
        };
        var _setPreviewHeight = function(data) {
            if (data.height > previewInitialHeight) {
                elem.find('[data-role="previewFrame"]').css({
                    height: data.height + 'px'
                });
            }
        };
        var _sendMessage = function(data) {
            Debug.log('Sending message FROM parent');
            console.log(data);
            previewIframe.postMessage(JSON.stringify(data), ips.utils.url.getOrigin());
        };
        return {
            init: init,
            focus: focus,
            unminimize: unminimize,
            insertQuotes: insertQuotes,
            insertHtml: insertHtml,
            updateImage: updateImage,
            reset: reset,
            destruct: destruct,
            saveAndClearAutosave: saveAndClearAutosave
        };
    };
}(jQuery, _));;;



$.ready();
velem=$(document).find('[data-role="replyArea"] [data-ipsEditor]');
if (velem.length==0){
velem=$(document).find('[data-role="editor"] [data-ipsEditor]');
}
if (velem.length>0)
{
//console.log(velem.find('[data-role="previewFrame"]'));
velem.find('[data-role="previewFrame"]').remove();
$("iframe").remove();
editor = ips.ui.editor.getObj(velem);
editor.destruct();
$(velem).data('_editor',null);
ips.ui.editor.respond( velem,{});
editor = ips.ui.editor.getObj(velem);
velem.find('[role="application"]').first().remove();
console.log("rem.");
}

console.log("loaded.");
}) ();
//editor.init();