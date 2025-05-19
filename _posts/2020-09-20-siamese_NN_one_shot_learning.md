---
title: Siamese Neural Networks for One-shot Image Recognition
date: 2020-10-25 01:52:00 +0800
categories: [Blogging, Side-projects]
tags: [siamese, one-shot]     # TAG names should always be lowercase
---

In this blog post, I will be exploring a way on how the deep learning approaches can be used to solve the one-shot learning problem. I will be replicating Koch et al.'s work to understand how a Siamese Neural Network can be used for one-shot image recognition.

<!--truncate-->

## Introduction

Deep learning has been quite popular for image recognition and classification tasks in recent years due to its high performances. However, traditional deep learning approaches usually require a large dataset for the model to be trained on to distinguish very few different classes, which is drastically different from how humans are able to learn from even very few examples.

Few-shot or one-shot learning is a categorization problem that aims to classify objects given only a limited amount of samples, with the ultimate goal of creating a more human-like learning algorithm.

Traditional deep networks usually don’t work well with one shot or few shot learning, since very few samples per class is very likely to cause overfitting. To prevent the overfitting problem and extend it to unseen characters, koch et al. proposed to use the Siamese Network.

## Method

Figure 1 is the backbone architecture of the Convolutional Siamese Network. Unlike traditional CNNs that take an input of 1 image to generate a one-hot vector suggesting the category the image belongs to, the Siamese network takes in 2 images and feeds them into 2 CNNs with the same structure. The output would be merged together, in this case through their absolute differences, and feed into fully connected layers to output one number representing the similarity of the two images. A larger number implies that the two images are more similar.

![cnn siamese network arch](/assets/img/siamese_NN_one_shot_learning/siamese_cnn.png){: w="500" h="300" } *Convolutional Siamese Network Architecture [2]*

Instead of learning which image belongs to which class, the Siamese network learns how to determine the “similarity” between two images. After training, given a completely new image, the network could then compare the image to an image from each of the categories and determine which category is the most similar to the given image.

The convolutional architecture I will try to build will be from from Koch et al. in his paper “Siamese Neural Networks for One-shot Image Recognition”, as portrayed in Figure 2.

![siamese network arch](/assets/img/siamese_NN_one_shot_learning/siamese_cnn_koch.png){: w="500" h="350" } *Siamese Network Architecture by Koch et al.[2]*

## Dataset overview

The Omniglot handwritten character dataset is a dataset for one-shot learning, proposed by Lake et al. It contains 1623 different handwritten characters from 50 different series of alphabets, where each character was handwritten by 20 different people. Each image is 105x105 pixels large. The 50 alphabets are divided into a 30:20 ratio for training and testing, which means that the test set is on a completely new set of characters that are unseen before.

![omniglot dataset overview](/assets/img/siamese_NN_one_shot_learning/omniglot_dataset.png){: w="500" h="200" } *Omniglot dataset overview*

## Experiment

I improved the network by adding batch normalization to make the converging process faster and more stable. The network is trained for 50 epochs. Figure 3. is the plot of the training and validation loss after every epoch, which, as we can see, shows a dramatic decrease and convergence towards the end. The validation loss decreases generally along with the training loss, indicating that no overfitting has occurred throughout the training. 

![siamese loss](/assets/img/siamese_NN_one_shot_learning/siamese_loss.png){: w="350" h="200" } *Network’s Training and Validation Loss*

## Evaluation on the model

### 4-way one shot learning
I first tested a 4-way one shot learning using a completely new set of images for evaluation, where all the testing images were not used during training, and no characters were known to the model either. The results showed an approximately 90% accuracy, which suggests that the model generalized pretty well to unseen datasets and categories, achieving our goal of one-shot learning on the Omniglot dataset.

### 20-way one shot learning
Afterwards, I performed a 20-way one shot learning evaluation for 200 sets. Where the result returned to be around 86%. 

## Result

#### Case 1

|                               Main Image                                |                                Image1                                |                                 Image2                                 |                                 Image3                                 |
| :---------------------------------------------------------------------: | :------------------------------------------------------------------: | :--------------------------------------------------------------------: | :--------------------------------------------------------------------: |
| ![oneshot main](/assets/img/siamese_NN_one_shot_learning/oneshot_m.png) | ![oneshot m](/assets/img/siamese_NN_one_shot_learning/oneshot_m.png) | ![oneshot i2](/assets/img/siamese_NN_one_shot_learning/oneshot_i2.png) | ![oneshot i3](/assets/img/siamese_NN_one_shot_learning/oneshot_i3.png) |

#### Output
![siamese bestcase](/assets/img/siamese_NN_one_shot_learning/siamese_bestcase.png){: w="350" h="200" } *Best match when the image set contains an image similar to main image*

#### Case 2

|                               Main Image                                |                                  Image 1                                   |                                  Image 2                                   |                                  Image 3                                   |
| :---------------------------------------------------------------------: | :------------------------------------------------------------------------: | :------------------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![oneshot main](/assets/img/siamese_NN_one_shot_learning/oneshot_m.png) | ![oneshot image1](/assets/img/siamese_NN_one_shot_learning/oneshot_i1.png) | ![oneshot image2](/assets/img/siamese_NN_one_shot_learning/oneshot_i2.png) | ![oneshot image3](/assets/img/siamese_NN_one_shot_learning/oneshot_i3.png) |


#### Output

![siamese worstcase](/assets/img/siamese_NN_one_shot_learning/siamese_worstcase.png){: w="350" h="250" } *Best match when the image set does not contain image similar to main image*

## Code

The complete code used in this post can be found in my [GitHub repo](https://github.com/vinodrajendran001/one_shot_learning).

## References

1. Koch, Gregory, Richard Zemel, and Ruslan Salakhutdinov. "Siamese neural networks for one-shot image recognition." ICML Deep Learning Workshop. Vol. 2. 2015.
2. [https://towardsdatascience.com/building-a-one-shot-learning-network-with-pytorch-d1c3a5fafa4a?gi=325652587db8](https://towardsdatascience.com/building-a-one-shot-learning-network-with-pytorch-d1c3a5fafa4a?gi=325652587db8)
